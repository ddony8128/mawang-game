"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomsRouter = void 0;
const crypto_1 = __importDefault(require("crypto"));
const express_1 = require("express");
const tokenHash_1 = require("../../auth/tokenHash");
const roomPlayersRepo_1 = require("../../db/roomPlayersRepo");
const gamesRepo_1 = require("../../db/gamesRepo");
const roomsRepo_1 = require("../../db/roomsRepo");
const supabase_1 = require("../../db/supabase");
const apiResponse_1 = require("../apiResponse");
const auth_1 = require("../middleware/auth");
exports.roomsRouter = (0, express_1.Router)();
function getDeviceIdHeader(req) {
    const raw = req.header("x-device-id") ?? req.header("X-Device-Id");
    if (!raw)
        return null;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return v && v.length > 0 ? v : null;
}
// GDD 기반 기본 게임 설정 (document/ServerStateModel 3. GameSettings)
const DEFAULT_GAME_SETTINGS = {
    // 카드/드로우
    drawIntervalSec: 180, // 3분
    bombDelaySec: 300, // 5분
    handLimit: 4,
    // 마왕
    fearReviveHp: 3,
    trollSurviveSec: 180,
    // 팀 구성(마왕 1명 + 아래 구성)
    teamCounts: {
        traitor: 1,
        hero: 3,
        civil: 1,
    },
    // GM 모드 (기본 비활성화)
    gmMode: {
        enabled: false,
        hostIsGM: false,
        fixedRoles: {},
    },
};
function hashRoomPassword(roomId, password) {
    // 방 비밀번호용 단순 해시 (roomId 를 salt 로 사용)
    return crypto_1.default.scryptSync(password, roomId, 32).toString("hex");
}
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
    const deviceId = getDeviceIdHeader(req);
    if (typeof nickname !== "string" || nickname.trim().length < 1) {
        return (0, apiResponse_1.sendError)(res, "BAD_REQUEST", "invalid nickname");
    }
    if (typeof roomTitle !== "string" || roomTitle.trim().length < 1) {
        return (0, apiResponse_1.sendError)(res, "BAD_REQUEST", "invalid roomTitle");
    }
    try {
        const isLocked = typeof password === "string" && password.length > 0;
        const roomId = crypto_1.default.randomUUID();
        const passwordHash = isLocked && typeof password === "string" && password.length > 0
            ? hashRoomPassword(roomId, password)
            : null;
        const { data: room, error: roomError } = await supabase_1.supabase
            .from("rooms")
            .insert({
            id: roomId,
            title: roomTitle,
            is_locked: isLocked,
            password_hash: passwordHash,
            settings: DEFAULT_GAME_SETTINGS,
        })
            .select("*")
            .single();
        if (roomError || !room) {
            // eslint-disable-next-line no-console
            console.error("[supabase][create room insert rooms] error:", roomError);
            return (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to create room", 500);
        }
        const roomPlayerId = crypto_1.default.randomUUID();
        const sessionToken = crypto_1.default.randomBytes(32).toString("hex");
        const sessionTokenHash = (0, tokenHash_1.hashSessionToken)(sessionToken);
        // 비밀번호 해시와 호스트 플레이어를 한 번에 생성
        const { error: playerError } = await supabase_1.supabase.from("room_players").insert({
            id: roomPlayerId,
            room_id: roomId,
            nickname,
            is_host: true,
            is_ready: false,
            is_in_room: true,
            session_token_hash: sessionTokenHash,
            device_id: deviceId,
        });
        if (playerError) {
            // eslint-disable-next-line no-console
            console.error("[supabase][create room insert room_players] error:", playerError);
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
        // eslint-disable-next-line no-console
        console.error("[roomsRouter][POST /rooms] unexpected error:", err);
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to create room", 500);
    }
});
// 3.3 POST /rooms/{roomId}/join
exports.roomsRouter.post("/:roomId/join", async (req, res) => {
    const { roomId } = req.params;
    const { nickname, password } = req.body ?? {};
    const deviceId = getDeviceIdHeader(req);
    if (typeof nickname !== "string" || nickname.trim().length < 1) {
        return (0, apiResponse_1.sendError)(res, "BAD_REQUEST", "invalid nickname");
    }
    try {
        const { data: room, error: roomError } = await supabase_1.supabase
            .from("rooms")
            .select("*")
            .eq("id", roomId)
            .single();
        if (roomError || !room) {
            // eslint-disable-next-line no-console
            console.error("[supabase][join room select rooms] error:", roomError);
            return (0, apiResponse_1.sendError)(res, "NOT_FOUND", "room not found", 404);
        }
        if (room.is_locked) {
            const storedPasswordHash = room.password_hash;
            const provided = typeof password === "string" ? password : "";
            const inputHash = provided.length > 0 ? hashRoomPassword(roomId, provided) : null;
            if (!storedPasswordHash || !inputHash || storedPasswordHash !== inputHash) {
                return (0, apiResponse_1.sendError)(res, "CONFLICT", "invalid password", 409);
            }
        }
        const { count, error: countError } = await supabase_1.supabase
            .from("room_players")
            .select("id", { count: "exact", head: true })
            .eq("room_id", roomId)
            .eq("is_in_room", true);
        if (countError) {
            // eslint-disable-next-line no-console
            console.error("[supabase][join room count room_players] error:", countError);
            return (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to count players", 500);
        }
        const maxPlayers = room.max_players ?? 10;
        if ((count ?? 0) >= maxPlayers) {
            return (0, apiResponse_1.sendError)(res, "CONFLICT", "room is full", 409);
        }
        const roomPlayerId = crypto_1.default.randomUUID();
        const sessionToken = crypto_1.default.randomBytes(32).toString("hex");
        const sessionTokenHash = (0, tokenHash_1.hashSessionToken)(sessionToken);
        const { error: insertError } = await supabase_1.supabase.from("room_players").insert({
            id: roomPlayerId,
            room_id: roomId,
            nickname,
            is_host: false,
            is_ready: false,
            is_in_room: true,
            session_token_hash: sessionTokenHash,
            device_id: deviceId,
        });
        if (insertError) {
            // eslint-disable-next-line no-console
            console.error("[supabase][join room insert room_players] error:", insertError);
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
        // eslint-disable-next-line no-console
        console.error("[roomsRouter][POST /rooms/:roomId/join] unexpected error:", err);
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to join room", 500);
    }
});
// 4.1 GET /rooms/{roomId}/poll
exports.roomsRouter.get("/:roomId/poll", auth_1.requireRoomAuth, async (req, res) => {
    const roomId = req.auth.roomId;
    try {
        const { data: room, error: roomError } = await supabase_1.supabase
            .from("rooms")
            .select("id,title,phase,host_player_id,settings")
            .eq("id", roomId)
            .single();
        if (roomError || !room) {
            // eslint-disable-next-line no-console
            console.error("[supabase][poll room select rooms] error:", roomError);
            return (0, apiResponse_1.sendError)(res, "NOT_FOUND", "room not found", 404);
        }
        const players = await (0, roomPlayersRepo_1.listRoomPlayers)(roomId);
        // v1: countdown / revision / unchanged 는 단순 값으로 응답
        const nowMs = Date.now();
        const settings = room.settings ?? {};
        const endsAtMsRaw = settings.lobbyCountdownEndsAtMs;
        let countdown = null;
        if (typeof endsAtMsRaw === "number") {
            const endsAtMs = endsAtMsRaw;
            const active = nowMs < endsAtMs;
            countdown = { active, endsAtMs };
        }
        const revision = nowMs;
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
        // eslint-disable-next-line no-console
        console.error("[roomsRouter][GET /rooms/:roomId/poll] unexpected error:", err);
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to poll room", 500);
    }
});
// 4.2 POST /rooms/{roomId}/ready
exports.roomsRouter.post("/:roomId/ready", auth_1.requireRoomAuth, async (req, res) => {
    const roomId = req.auth.roomId;
    const { ready } = req.body ?? {};
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
            // eslint-disable-next-line no-console
            console.error("[supabase][ready room select rooms] error:", roomError);
            return (0, apiResponse_1.sendError)(res, "NOT_FOUND", "room not found", 404);
        }
        if (room.phase !== "lobby") {
            return (0, apiResponse_1.sendError)(res, "CONFLICT", "room is not in lobby phase", 409);
        }
        const { data, error } = await supabase_1.supabase
            .from("room_players")
            .update({ is_ready: ready })
            .eq("id", req.auth.roomPlayerId)
            .eq("room_id", roomId)
            .select("is_ready")
            .single();
        if (error || !data) {
            // eslint-disable-next-line no-console
            console.error("[supabase][ready room update room_players] error:", error);
            return (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to update ready state", 500);
        }
        (0, apiResponse_1.sendOk)(res, { isReady: data.is_ready });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("[roomsRouter][POST /rooms/:roomId/ready] unexpected error:", err);
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to update ready state", 500);
    }
});
// 4.3 GET /rooms/{roomId}/settings (host only)
exports.roomsRouter.get("/:roomId/settings", auth_1.requireRoomAuth, auth_1.requireHost, async (req, res) => {
    const roomId = req.auth.roomId;
    try {
        const { data, error } = await supabase_1.supabase
            .from("rooms")
            .select("settings")
            .eq("id", roomId)
            .single();
        if (error || !data) {
            // eslint-disable-next-line no-console
            console.error("[supabase][get settings select rooms] error:", error);
            return (0, apiResponse_1.sendError)(res, "NOT_FOUND", "room not found", 404);
        }
        (0, apiResponse_1.sendOk)(res, { settings: data.settings ?? {} });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("[roomsRouter][GET /rooms/:roomId/settings] unexpected error:", err);
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to get settings", 500);
    }
});
// 4.4 PATCH /rooms/{roomId}/settings (host only)
exports.roomsRouter.patch("/:roomId/settings", auth_1.requireRoomAuth, auth_1.requireHost, async (req, res) => {
    const roomId = req.auth.roomId;
    const { settings } = req.body ?? {};
    if (typeof settings !== "object" || settings == null) {
        return (0, apiResponse_1.sendError)(res, "BAD_REQUEST", "settings must be object");
    }
    const validated = validateRoomSettings(settings);
    if (!validated.ok) {
        return (0, apiResponse_1.sendError)(res, "BAD_REQUEST", validated.message ?? "invalid settings");
    }
    try {
        const { data, error } = await supabase_1.supabase
            .from("rooms")
            .update({ settings: validated.value })
            .eq("id", roomId)
            .select("settings")
            .single();
        if (error || !data) {
            // eslint-disable-next-line no-console
            console.error("[supabase][patch settings update rooms] error:", error);
            return (0, apiResponse_1.sendError)(res, "NOT_FOUND", "room not found", 404);
        }
        (0, apiResponse_1.sendOk)(res, { settings: data.settings });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("[roomsRouter][PATCH /rooms/:roomId/settings] unexpected error:", err);
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to update settings", 500);
    }
});
// 4.5 POST /rooms/{roomId}/start
exports.roomsRouter.post("/:roomId/start", auth_1.requireRoomAuth, auth_1.requireHost, async (req, res) => {
    const roomId = req.auth.roomId;
    const countdownSec = typeof req.body?.countdownSec === "number" ? req.body.countdownSec : 5;
    try {
        const { data: room, error: roomError } = await supabase_1.supabase
            .from("rooms")
            .select("id,phase,max_players,settings")
            .eq("id", roomId)
            .single();
        if (roomError || !room) {
            // eslint-disable-next-line no-console
            console.error("[supabase][start room select rooms] error:", roomError);
            return (0, apiResponse_1.sendError)(res, "NOT_FOUND", "room not found", 404);
        }
        if (room.phase !== "lobby") {
            return (0, apiResponse_1.sendError)(res, "CONFLICT", "room is not in lobby phase", 409);
        }
        // 인원/준비 상태 검증
        const players = await (0, roomPlayersRepo_1.listRoomPlayers)(roomId);
        const inRoomPlayers = players.filter((p) => p.is_in_room);
        // TODO: GDD 상 최소 인원은 6명이지만,
        // 개발/테스트 편의를 위해 일시적으로 2인 플레이를 허용한다.
        // 2인 방일 경우 역할은 "랜덤 마왕 1명 + 랜덤 용사 1명"으로 구성된다.
        if (inRoomPlayers.length < 2) {
            return (0, apiResponse_1.sendError)(res, "CONFLICT", "at least 2 players required", 409);
        }
        const maxPlayers = room.max_players ?? 10;
        if (inRoomPlayers.length > maxPlayers) {
            return (0, apiResponse_1.sendError)(res, "CONFLICT", "too many players in room", 409);
        }
        const hostPlayer = inRoomPlayers.find((p) => p.is_host);
        const others = inRoomPlayers.filter((p) => !p.is_host);
        if (!hostPlayer) {
            return (0, apiResponse_1.sendError)(res, "CONFLICT", "host player not found", 409);
        }
        const notReady = others.filter((p) => !p.is_ready);
        if (notReady.length > 0) {
            return (0, apiResponse_1.sendError)(res, "CONFLICT", "all non-host players must be ready", 409);
        }
        // 게임 row 생성
        // - v1: seq 는 1부터 시작하는 단순 값으로 사용한다.
        //   (추후 여러 판을 지원할 때는 games 테이블에서 room_id 기준 max(seq)+1 을 계산하도록 확장 가능)
        const currentSettings = room.settings ?? {};
        const gameRecord = await (0, gamesRepo_1.createGameForRoom)({
            roomId,
            settings: currentSettings,
        });
        const gameId = gameRecord.id;
        // 방 phase 를 game 으로 전환
        const endsAtMs = Date.now() + countdownSec * 1000;
        const { error: updateRoomError } = await supabase_1.supabase
            .from("rooms")
            .update({
            phase: "game",
            settings: {
                ...currentSettings,
                lobbyCountdownEndsAtMs: endsAtMs,
            },
        })
            .eq("id", roomId);
        if (updateRoomError) {
            // eslint-disable-next-line no-console
            console.error("[supabase][start room update rooms.phase] error:", updateRoomError);
            return (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to update room phase", 500);
        }
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
        // eslint-disable-next-line no-console
        console.error("[roomsRouter][POST /rooms/:roomId/start] unexpected error:", err);
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to start game", 500);
    }
});
// 5.1 DELETE /rooms/{roomId}
exports.roomsRouter.delete("/:roomId", auth_1.requireRoomAuth, auth_1.requireHost, async (req, res) => {
    const roomId = req.auth.roomId;
    try {
        const { error } = await supabase_1.supabase.from("rooms").delete().eq("id", roomId);
        if (error) {
            // eslint-disable-next-line no-console
            console.error("[supabase][delete room] error:", error);
            return (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to delete room", 500);
        }
        (0, apiResponse_1.sendOk)(res, { deleted: true });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("[roomsRouter][DELETE /rooms/:roomId] unexpected error:", err);
        (0, apiResponse_1.sendError)(res, "INTERNAL_ERROR", "failed to delete room", 500);
    }
});
function validateRoomSettings(raw) {
    const allowedDraw = [120, 180, 240]; // 2,3,4분
    const allowedBomb = [60, 180, 300, 420]; // 1,3,5,7분
    const allowedHandLimit = [3, 4, 5];
    const drawIntervalSec = raw.drawIntervalSec;
    const bombDelaySec = raw.bombDelaySec;
    const handLimit = raw.handLimit;
    const fearReviveHp = raw.fearReviveHp;
    const trollSurviveSec = raw.trollSurviveSec;
    const teamCounts = raw.teamCounts ?? {};
    if (!allowedDraw.includes(drawIntervalSec)) {
        return { ok: false, message: "invalid drawIntervalSec" };
    }
    if (!allowedBomb.includes(bombDelaySec)) {
        return { ok: false, message: "invalid bombDelaySec" };
    }
    if (!allowedHandLimit.includes(handLimit)) {
        return { ok: false, message: "invalid handLimit" };
    }
    if (typeof fearReviveHp !== "number" ||
        fearReviveHp < 1 ||
        fearReviveHp > 3) {
        return { ok: false, message: "invalid fearReviveHp" };
    }
    if (typeof trollSurviveSec !== "number" ||
        trollSurviveSec <= 0) {
        return { ok: false, message: "invalid trollSurviveSec" };
    }
    const traitor = typeof teamCounts.traitor === "number" && Number.isInteger(teamCounts.traitor)
        ? teamCounts.traitor
        : 1;
    const hero = typeof teamCounts.hero === "number" && Number.isInteger(teamCounts.hero)
        ? teamCounts.hero
        : 3;
    const civil = typeof teamCounts.civil === "number" && Number.isInteger(teamCounts.civil)
        ? teamCounts.civil
        : 1;
    // GDD 기반 팀 구성 범위 검증
    // - 배신자: 최대 2명
    // - 용사: 최대 4명 (커스터마이즈 허용)
    // - 시민: 최대 4명 (5명 이상은 허용하지 않음)
    if (traitor < 0 || traitor > 2) {
        return {
            ok: false,
            message: "invalid teamCounts: traitor must be between 0 and 2",
        };
    }
    if (hero < 0 || hero > 4) {
        return {
            ok: false,
            message: "invalid teamCounts: hero must be between 0 and 4",
        };
    }
    if (civil < 0 || civil > 4) {
        return {
            ok: false,
            message: "invalid teamCounts: civil must be between 0 and 4",
        };
    }
    const total = traitor + hero + civil;
    if (total < 3 || total > 10) {
        return { ok: false, message: "invalid teamCounts" };
    }
    return {
        ok: true,
        value: {
            ...raw,
            drawIntervalSec,
            bombDelaySec,
            handLimit,
            fearReviveHp,
            trollSurviveSec,
            teamCounts: { traitor, hero, civil },
        },
    };
}
