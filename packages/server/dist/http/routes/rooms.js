"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomsRouter = void 0;
const express_1 = require("express");
const roomPlayersRepo_1 = require("../../db/roomPlayersRepo");
const roomsRepo_1 = require("../../db/roomsRepo");
const apiResponse_1 = require("../apiResponse");
const supabase_1 = require("../../db/supabase");
exports.roomsRouter = (0, express_1.Router)();
// 3.1 GET /rooms
exports.roomsRouter.get("/", async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
        const { rooms, nextCursor } = await (0, roomsRepo_1.listRooms)({ limit, cursor });
        (0, apiResponse_1.sendOk)(res, { rooms, nextCursor });
    }
    catch (err) {
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to list rooms", 500);
    }
});
// 3.2 POST /rooms
exports.roomsRouter.post("/", async (req, res) => {
    const { nickname, roomTitle, password } = req.body ?? {};
    if (typeof nickname !== "string" || nickname.trim().length < 2) {
        return (0, apiResponse_1.sendError)(res, "BAD_REQUEST", "invalid nickname");
    }
    if (typeof roomTitle !== "string" || roomTitle.trim().length < 2) {
        return (0, apiResponse_1.sendError)(res, "BAD_REQUEST", "invalid roomTitle");
    }
    try {
        const isLocked = typeof password === "string" && password.length > 0;
        const { data: room, error: roomError } = await supabase_1.supabase
            .from("rooms")
            .insert({
            title: roomTitle,
            is_locked: isLocked,
            // 서버에서 해시 처리해야 하지만, v1 스켈레톤에서는 평문 저장(추후 교체)
            password_hash: isLocked ? password : null,
        })
            .select("*")
            .single();
        if (roomError || !room) {
            return (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to create room", 500);
        }
        const roomId = room.id;
        const roomPlayerId = crypto.randomUUID();
        const sessionToken = crypto.randomUUID();
        const { error: playerError } = await supabase_1.supabase.from("room_players").insert({
            id: roomPlayerId,
            room_id: roomId,
            nickname,
            is_host: true,
            is_ready: false,
            is_in_room: true,
            // device_id / session_token_hash 등은 추후 보강
        });
        if (playerError) {
            return (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to create host player", 500);
        }
        (0, apiResponse_1.sendOk)(res, {
            room: {
                roomId,
                roomTitle,
                isLocked,
                phase: "lobby",
                maxPlayers: room.max_players ?? 10,
            },
            session: {
                roomPlayerId,
                sessionToken,
                isHost: true,
            },
        });
    }
    catch (err) {
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to create room", 500);
    }
});
// 3.3 POST /rooms/{roomId}/join
exports.roomsRouter.post("/:roomId/join", async (req, res) => {
    const { roomId } = req.params;
    const { nickname, password } = req.body ?? {};
    if (typeof nickname !== "string" || nickname.trim().length < 2) {
        return (0, apiResponse_1.sendError)(res, "BAD_REQUEST", "invalid nickname");
    }
    try {
        const { data: room, error: roomError } = await supabase_1.supabase
            .from("rooms")
            .select("*")
            .eq("id", roomId)
            .single();
        if (roomError || !room) {
            return (0, apiResponse_1.sendError)(res, "NOT_FOUND", "room not found", 404);
        }
        if (room.is_locked) {
            const storedPassword = room.password_hash;
            if (!storedPassword || storedPassword !== password) {
                return (0, apiResponse_1.sendError)(res, "CONFLICT", "invalid password", 409);
            }
        }
        const { count, error: countError } = await supabase_1.supabase
            .from("room_players")
            .select("id", { count: "exact", head: true })
            .eq("room_id", roomId)
            .eq("is_in_room", true);
        if (countError) {
            return (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to count players", 500);
        }
        const maxPlayers = room.max_players ?? 10;
        if ((count ?? 0) >= maxPlayers) {
            return (0, apiResponse_1.sendError)(res, "CONFLICT", "room is full", 409);
        }
        const roomPlayerId = crypto.randomUUID();
        const sessionToken = crypto.randomUUID();
        const { error: insertError } = await supabase_1.supabase.from("room_players").insert({
            id: roomPlayerId,
            room_id: roomId,
            nickname,
            is_host: false,
            is_ready: false,
            is_in_room: true,
        });
        if (insertError) {
            return (0, apiResponse_1.sendError)(res, "CONFLICT", "failed to join room", 409);
        }
        (0, apiResponse_1.sendOk)(res, {
            room: {
                roomId,
                roomTitle: room.title,
                isLocked: room.is_locked,
                phase: room.phase === "game" ? "game" : "lobby",
                maxPlayers,
            },
            session: {
                roomPlayerId,
                sessionToken,
                isHost: false,
            },
        });
    }
    catch (err) {
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to join room", 500);
    }
});
// 4.1 GET /rooms/{roomId}/poll
exports.roomsRouter.get("/:roomId/poll", async (req, res) => {
    const { roomId } = req.params;
    try {
        const { data: room, error: roomError } = await supabase_1.supabase
            .from("rooms")
            .select("id,title,phase,host_player_id")
            .eq("id", roomId)
            .single();
        if (roomError || !room) {
            return (0, apiResponse_1.sendError)(res, "NOT_FOUND", "room not found", 404);
        }
        const players = await (0, roomPlayersRepo_1.listRoomPlayers)(roomId);
        // v1: countdown / revision / unchanged 는 단순 값으로 응답
        const countdown = null;
        const revision = Date.now();
        (0, apiResponse_1.sendOk)(res, {
            room: {
                roomId: room.id,
                roomTitle: room.title,
                phase: room.phase === "game" ? "game" : "lobby",
                hostRoomPlayerId: room.host_player_id ?? "",
            },
            players: players.map((p) => ({
                roomPlayerId: p.id,
                nickname: p.nickname,
                isHost: p.is_host,
                isReady: p.is_ready,
                wins: p.wins,
                losses: p.losses,
                isInRoom: p.is_in_room,
            })),
            countdown,
            revision,
            unchanged: false,
        });
    }
    catch (err) {
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to poll room", 500);
    }
});
// 4.2 POST /rooms/{roomId}/ready
exports.roomsRouter.post("/:roomId/ready", async (req, res) => {
    const { roomId } = req.params;
    const { ready } = req.body ?? {};
    const roomPlayerId = req.header("x-room-player-id") ?? req.header("X-Room-Player-Id");
    if (!roomPlayerId) {
        return (0, apiResponse_1.sendError)(res, "AUTH_REQUIRED", "missing X-Room-Player-Id", 401);
    }
    if (typeof ready !== "boolean") {
        return (0, apiResponse_1.sendError)(res, "BAD_REQUEST", "ready must be boolean");
    }
    try {
        const { data: room, error: roomError } = await supabase_1.supabase
            .from("rooms")
            .select("id,phase")
            .eq("id", roomId)
            .single();
        if (roomError || !room) {
            return (0, apiResponse_1.sendError)(res, "NOT_FOUND", "room not found", 404);
        }
        if (room.phase !== "lobby") {
            return (0, apiResponse_1.sendError)(res, "CONFLICT", "room is not in lobby phase", 409);
        }
        const { data, error } = await supabase_1.supabase
            .from("room_players")
            .update({ is_ready: ready })
            .eq("id", roomPlayerId)
            .eq("room_id", roomId)
            .select("is_ready")
            .single();
        if (error || !data) {
            return (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to update ready state", 500);
        }
        (0, apiResponse_1.sendOk)(res, { isReady: data.is_ready });
    }
    catch (err) {
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to update ready state", 500);
    }
});
// 4.3 GET /rooms/{roomId}/settings
exports.roomsRouter.get("/:roomId/settings", async (req, res) => {
    const { roomId } = req.params;
    try {
        const { data, error } = await supabase_1.supabase
            .from("rooms")
            .select("settings")
            .eq("id", roomId)
            .single();
        if (error || !data) {
            return (0, apiResponse_1.sendError)(res, "NOT_FOUND", "room not found", 404);
        }
        (0, apiResponse_1.sendOk)(res, { settings: data.settings ?? {} });
    }
    catch (err) {
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to get settings", 500);
    }
});
// 4.4 PATCH /rooms/{roomId}/settings
exports.roomsRouter.patch("/:roomId/settings", async (req, res) => {
    const { roomId } = req.params;
    const { settings } = req.body ?? {};
    if (typeof settings !== "object" || settings == null) {
        return (0, apiResponse_1.sendError)(res, "BAD_REQUEST", "settings must be object");
    }
    try {
        const { data, error } = await supabase_1.supabase
            .from("rooms")
            .update({ settings })
            .eq("id", roomId)
            .select("settings")
            .single();
        if (error || !data) {
            return (0, apiResponse_1.sendError)(res, "NOT_FOUND", "room not found", 404);
        }
        (0, apiResponse_1.sendOk)(res, { settings: data.settings });
    }
    catch (err) {
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to update settings", 500);
    }
});
// 4.5 POST /rooms/{roomId}/start
exports.roomsRouter.post("/:roomId/start", async (req, res) => {
    const { roomId } = req.params;
    const countdownSec = typeof req.body?.countdownSec === "number" ? req.body.countdownSec : 5;
    try {
        const { data: room, error: roomError } = await supabase_1.supabase
            .from("rooms")
            .select("id,phase,max_players,settings")
            .eq("id", roomId)
            .single();
        if (roomError || !room) {
            return (0, apiResponse_1.sendError)(res, "NOT_FOUND", "room not found", 404);
        }
        if (room.phase !== "lobby") {
            return (0, apiResponse_1.sendError)(res, "CONFLICT", "room is not in lobby phase", 409);
        }
        // 인원/준비 상태 검증은 추후 보강
        const gameId = crypto.randomUUID();
        const endsAtMs = Date.now() + countdownSec * 1000;
        (0, apiResponse_1.sendOk)(res, {
            started: true,
            countdown: {
                active: true,
                endsAtMs,
            },
            gameId,
        });
    }
    catch (err) {
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to start game", 500);
    }
});
// 5.1 DELETE /rooms/{roomId}
exports.roomsRouter.delete("/:roomId", async (req, res) => {
    const { roomId } = req.params;
    try {
        const { error } = await supabase_1.supabase.from("rooms").delete().eq("id", roomId);
        if (error) {
            return (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to delete room", 500);
        }
        (0, apiResponse_1.sendOk)(res, { deleted: true });
    }
    catch (err) {
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to delete room", 500);
    }
});
