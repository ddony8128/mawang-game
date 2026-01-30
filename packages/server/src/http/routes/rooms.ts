import crypto from "crypto";

import { Router } from "express";

import { hashSessionToken } from "../../auth/tokenHash";
import { listRoomPlayers } from "../../db/roomPlayersRepo";
import { listRooms } from "../../db/roomsRepo";
import { supabase } from "../../db/supabase";
import { sendError, sendOk } from "../apiResponse";
import { requireHost, requireRoomAuth } from "../middleware/auth";

export const roomsRouter = Router();

// 3.1 GET /rooms
roomsRouter.get("/", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const { rooms, nextCursor } = await listRooms({ limit, cursor });
    sendOk(res, { rooms, nextCursor });
  } catch (err) {
    sendError(res, "INTERNAL_ERROR", "failed to list rooms", 500);
  }
});

// 3.2 POST /rooms
roomsRouter.post("/", async (req, res) => {
  const { nickname, roomTitle, password } = req.body ?? {};

  if (typeof nickname !== "string" || nickname.trim().length < 2) {
    return sendError(res, "BAD_REQUEST", "invalid nickname");
  }
  if (typeof roomTitle !== "string" || roomTitle.trim().length < 2) {
    return sendError(res, "BAD_REQUEST", "invalid roomTitle");
  }

  try {
    const isLocked = typeof password === "string" && password.length > 0;

    const { data: room, error: roomError } = await supabase
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
      return sendError(res, "INTERNAL_ERROR", "failed to create room", 500);
    }

    const roomId = room.id as string;
    const roomPlayerId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionTokenHash = hashSessionToken(sessionToken);

    const { error: playerError } = await supabase.from("room_players").insert({
      id: roomPlayerId,
      room_id: roomId,
      nickname,
      is_host: true,
      is_ready: false,
      is_in_room: true,
      session_token_hash: sessionTokenHash,
      // device_id 는 X-Device-Id 를 본격적으로 사용할 때 채운다.
    });

    if (playerError) {
      return sendError(res, "INTERNAL_ERROR", "failed to create host player", 500);
    }

    sendOk(res, {
      room: {
        roomId,
        roomTitle,
        isLocked,
        phase: "lobby" as const,
        maxPlayers: room.max_players ?? 10,
      },
      session: {
        roomPlayerId,
        sessionToken,
        isHost: true,
      },
    });
  } catch (err) {
    sendError(res, "INTERNAL_ERROR", "failed to create room", 500);
  }
});

// 3.3 POST /rooms/{roomId}/join
roomsRouter.post("/:roomId/join", async (req, res) => {
  const { roomId } = req.params;
  const { nickname, password } = req.body ?? {};

  if (typeof nickname !== "string" || nickname.trim().length < 2) {
    return sendError(res, "BAD_REQUEST", "invalid nickname");
  }

  try {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return sendError(res, "NOT_FOUND", "room not found", 404);
    }

    if (room.is_locked) {
      const storedPassword = room.password_hash as string | null;
      if (!storedPassword || storedPassword !== password) {
        return sendError(res, "CONFLICT", "invalid password", 409);
      }
    }

    const { count, error: countError } = await supabase
      .from("room_players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("is_in_room", true);

    if (countError) {
      return sendError(res, "INTERNAL_ERROR", "failed to count players", 500);
    }
    const maxPlayers = room.max_players ?? 10;
    if ((count ?? 0) >= maxPlayers) {
      return sendError(res, "CONFLICT", "room is full", 409);
    }

    const roomPlayerId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionTokenHash = hashSessionToken(sessionToken);

    const { error: insertError } = await supabase.from("room_players").insert({
      id: roomPlayerId,
      room_id: roomId,
      nickname,
      is_host: false,
      is_ready: false,
      is_in_room: true,
      session_token_hash: sessionTokenHash,
    });

    if (insertError) {
      return sendError(res, "CONFLICT", "failed to join room", 409);
    }

    sendOk(res, {
      room: {
        roomId,
        roomTitle: room.title as string,
        isLocked: room.is_locked as boolean,
        phase: room.phase === "game" ? "game" : "lobby",
        maxPlayers,
      },
      session: {
        roomPlayerId,
        sessionToken,
        isHost: false,
      },
    });
  } catch (err) {
    sendError(res, "INTERNAL_ERROR", "failed to join room", 500);
  }
});

// 4.1 GET /rooms/{roomId}/poll
roomsRouter.get("/:roomId/poll", requireRoomAuth, async (req, res) => {
  const roomId = req.auth!.roomId;

  try {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id,title,phase,host_player_id")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return sendError(res, "NOT_FOUND", "room not found", 404);
    }

    const players = await listRoomPlayers(roomId);

    // v1: countdown / revision / unchanged 는 단순 값으로 응답
    const countdown = null;
    const revision = Date.now();

    sendOk(res, {
      room: {
        roomId: room.id as string,
        roomTitle: room.title as string,
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
  } catch (err) {
    sendError(res, "INTERNAL_ERROR", "failed to poll room", 500);
  }
});

// 4.2 POST /rooms/{roomId}/ready
roomsRouter.post("/:roomId/ready", requireRoomAuth, async (req, res) => {
  const roomId = req.auth!.roomId;
  const { ready } = req.body ?? {};

  if (typeof ready !== "boolean") {
    return sendError(res, "BAD_REQUEST", "ready must be boolean");
  }

  try {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id,phase")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return sendError(res, "NOT_FOUND", "room not found", 404);
    }

    if (room.phase !== "lobby") {
      return sendError(res, "CONFLICT", "room is not in lobby phase", 409);
    }

    const { data, error } = await supabase
      .from("room_players")
      .update({ is_ready: ready })
      .eq("id", req.auth!.roomPlayerId)
      .eq("room_id", roomId)
      .select("is_ready")
      .single();

    if (error || !data) {
      return sendError(res, "INTERNAL_ERROR", "failed to update ready state", 500);
    }

    sendOk(res, { isReady: data.is_ready as boolean });
  } catch (err) {
    sendError(res, "INTERNAL_ERROR", "failed to update ready state", 500);
  }
});

// 4.3 GET /rooms/{roomId}/settings
roomsRouter.get("/:roomId/settings", requireRoomAuth, async (req, res) => {
  const roomId = req.auth!.roomId;

  try {
    const { data, error } = await supabase
      .from("rooms")
      .select("settings")
      .eq("id", roomId)
      .single();

    if (error || !data) {
      return sendError(res, "NOT_FOUND", "room not found", 404);
    }

    sendOk(res, { settings: (data.settings as Record<string, any>) ?? {} });
  } catch (err) {
    sendError(res, "INTERNAL_ERROR", "failed to get settings", 500);
  }
});

// 4.4 PATCH /rooms/{roomId}/settings
roomsRouter.patch("/:roomId/settings", requireRoomAuth, async (req, res) => {
  const roomId = req.auth!.roomId;
  const { settings } = req.body ?? {};

  if (typeof settings !== "object" || settings == null) {
    return sendError(res, "BAD_REQUEST", "settings must be object");
  }

  try {
    const { data, error } = await supabase
      .from("rooms")
      .update({ settings })
      .eq("id", roomId)
      .select("settings")
      .single();

    if (error || !data) {
      return sendError(res, "NOT_FOUND", "room not found", 404);
    }

    sendOk(res, { settings: data.settings as Record<string, any> });
  } catch (err) {
    sendError(res, "INTERNAL_ERROR", "failed to update settings", 500);
  }
});

// 4.5 POST /rooms/{roomId}/start
roomsRouter.post("/:roomId/start", requireRoomAuth, requireHost, async (req, res) => {
  const roomId = req.auth!.roomId;
  const countdownSec =
    typeof req.body?.countdownSec === "number" ? req.body.countdownSec : 5;

  try {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id,phase,max_players,settings")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return sendError(res, "NOT_FOUND", "room not found", 404);
    }

    if (room.phase !== "lobby") {
      return sendError(res, "CONFLICT", "room is not in lobby phase", 409);
    }

    // 인원/준비 상태 검증은 추후 보강
    const gameId = crypto.randomUUID();
    const endsAtMs = Date.now() + countdownSec * 1000;

    sendOk(res, {
      started: true,
      countdown: {
        active: true,
        endsAtMs,
      },
      gameId,
    });
  } catch (err) {
    sendError(res, "INTERNAL_ERROR", "failed to start game", 500);
  }
});

// 5.1 DELETE /rooms/{roomId}
roomsRouter.delete("/:roomId", requireRoomAuth, requireHost, async (req, res) => {
  const roomId = req.auth!.roomId;

  try {
    const { error } = await supabase.from("rooms").delete().eq("id", roomId);
    if (error) {
      return sendError(res, "INTERNAL_ERROR", "failed to delete room", 500);
    }

    sendOk(res, { deleted: true });
  } catch (err) {
    sendError(res, "INTERNAL_ERROR", "failed to delete room", 500);
  }
});

