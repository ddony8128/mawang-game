import crypto from "crypto";

import { Router } from "express";

import { hashSessionToken } from "../../auth/tokenHash";
import { listRoomPlayers } from "../../db/roomPlayersRepo";
import { listRooms } from "../../db/roomsRepo";
import { supabase } from "../../db/supabase";
import { sendError, sendOk } from "../apiResponse";
import { requireHost, requireRoomAuth } from "../middleware/auth";

export const roomsRouter = Router();

function getDeviceIdHeader(req: import("express").Request): string | null {
  const raw = req.header("x-device-id") ?? req.header("X-Device-Id");
  if (!raw) return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.length > 0 ? v : null;
}

function hashRoomPassword(roomId: string, password: string): string {
  // 방 비밀번호용 단순 해시 (roomId 를 salt 로 사용)
  return crypto.scryptSync(password, roomId, 32).toString("hex");
}

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
  const deviceId = getDeviceIdHeader(req);

  if (typeof nickname !== "string" || nickname.trim().length < 1) {
    return sendError(res, "BAD_REQUEST", "invalid nickname");
  }
  if (typeof roomTitle !== "string" || roomTitle.trim().length < 1) {
    return sendError(res, "BAD_REQUEST", "invalid roomTitle");
  }

  try {
    const isLocked = typeof password === "string" && password.length > 0;
    const roomId = crypto.randomUUID();
    const passwordHash =
      isLocked && typeof password === "string" && password.length > 0
        ? hashRoomPassword(roomId, password)
        : null;

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        id: roomId,
        title: roomTitle,
        is_locked: isLocked,
        password_hash: passwordHash,
      })
      .select("*")
      .single();

    if (roomError || !room) {
      // eslint-disable-next-line no-console
      console.error("[supabase][create room insert rooms] error:", roomError);
      return sendError(res, "INTERNAL_ERROR", "failed to create room", 500);
    }

    const roomPlayerId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionTokenHash = hashSessionToken(sessionToken);

    // 비밀번호 해시와 호스트 플레이어를 한 번에 생성
    const { error: playerError } = await supabase.from("room_players").insert({
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
    // eslint-disable-next-line no-console
    console.error("[roomsRouter][POST /rooms] unexpected error:", err);
    sendError(res, "INTERNAL_ERROR", "failed to create room", 500);
  }
});

// 3.3 POST /rooms/{roomId}/join
roomsRouter.post("/:roomId/join", async (req, res) => {
  const { roomId } = req.params;
  const { nickname, password } = req.body ?? {};
  const deviceId = getDeviceIdHeader(req);

  if (typeof nickname !== "string" || nickname.trim().length < 1) {
    return sendError(res, "BAD_REQUEST", "invalid nickname");
  }

  try {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      // eslint-disable-next-line no-console
      console.error("[supabase][join room select rooms] error:", roomError);
      return sendError(res, "NOT_FOUND", "room not found", 404);
    }

    if (room.is_locked) {
      const storedPasswordHash = room.password_hash as string | null;
      const provided = typeof password === "string" ? password : "";
      const inputHash =
        provided.length > 0 ? hashRoomPassword(roomId, provided) : null;
      if (!storedPasswordHash || !inputHash || storedPasswordHash !== inputHash) {
        return sendError(res, "CONFLICT", "invalid password", 409);
      }
    }

    const { count, error: countError } = await supabase
      .from("room_players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("is_in_room", true);

    if (countError) {
      // eslint-disable-next-line no-console
      console.error("[supabase][join room count room_players] error:", countError);
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
      device_id: deviceId,
    });

    if (insertError) {
      // eslint-disable-next-line no-console
      console.error("[supabase][join room insert room_players] error:", insertError);
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
    // eslint-disable-next-line no-console
    console.error("[roomsRouter][POST /rooms/:roomId/join] unexpected error:", err);
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
      // eslint-disable-next-line no-console
      console.error("[supabase][poll room select rooms] error:", roomError);
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
    // eslint-disable-next-line no-console
    console.error("[roomsRouter][GET /rooms/:roomId/poll] unexpected error:", err);
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
      // eslint-disable-next-line no-console
      console.error("[supabase][ready room select rooms] error:", roomError);
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
      // eslint-disable-next-line no-console
      console.error("[supabase][ready room update room_players] error:", error);
      return sendError(res, "INTERNAL_ERROR", "failed to update ready state", 500);
    }

    sendOk(res, { isReady: data.is_ready as boolean });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[roomsRouter][POST /rooms/:roomId/ready] unexpected error:", err);
    sendError(res, "INTERNAL_ERROR", "failed to update ready state", 500);
  }
});

// 4.3 GET /rooms/{roomId}/settings (host only)
roomsRouter.get("/:roomId/settings", requireRoomAuth, requireHost, async (req, res) => {
  const roomId = req.auth!.roomId;

  try {
    const { data, error } = await supabase
      .from("rooms")
      .select("settings")
      .eq("id", roomId)
      .single();

    if (error || !data) {
      // eslint-disable-next-line no-console
      console.error("[supabase][get settings select rooms] error:", error);
      return sendError(res, "NOT_FOUND", "room not found", 404);
    }

    sendOk(res, { settings: (data.settings as Record<string, any>) ?? {} });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[roomsRouter][GET /rooms/:roomId/settings] unexpected error:", err);
    sendError(res, "INTERNAL_ERROR", "failed to get settings", 500);
  }
});

// 4.4 PATCH /rooms/{roomId}/settings (host only)
roomsRouter.patch("/:roomId/settings", requireRoomAuth, requireHost, async (req, res) => {
  const roomId = req.auth!.roomId;
  const { settings } = req.body ?? {};

  if (typeof settings !== "object" || settings == null) {
    return sendError(res, "BAD_REQUEST", "settings must be object");
  }

  const validated = validateRoomSettings(settings);
  if (!validated.ok) {
    return sendError(res, "BAD_REQUEST", validated.message ?? "invalid settings");
  }

  try {
    const { data, error } = await supabase
      .from("rooms")
      .update({ settings: validated.value })
      .eq("id", roomId)
      .select("settings")
      .single();

    if (error || !data) {
      // eslint-disable-next-line no-console
      console.error("[supabase][patch settings update rooms] error:", error);
      return sendError(res, "NOT_FOUND", "room not found", 404);
    }

    sendOk(res, { settings: data.settings as Record<string, any> });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[roomsRouter][PATCH /rooms/:roomId/settings] unexpected error:", err);
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
      // eslint-disable-next-line no-console
      console.error("[supabase][start room select rooms] error:", roomError);
      return sendError(res, "NOT_FOUND", "room not found", 404);
    }

    if (room.phase !== "lobby") {
      return sendError(res, "CONFLICT", "room is not in lobby phase", 409);
    }

    // 인원/준비 상태 검증
    const players = await listRoomPlayers(roomId);
    const inRoomPlayers = players.filter((p) => p.is_in_room);

    if (inRoomPlayers.length < 6) {
      return sendError(res, "CONFLICT", "at least 6 players required", 409);
    }
    const maxPlayers = room.max_players ?? 10;
    if (inRoomPlayers.length > maxPlayers) {
      return sendError(res, "CONFLICT", "too many players in room", 409);
    }

    const hostPlayer = inRoomPlayers.find((p) => p.is_host);
    const others = inRoomPlayers.filter((p) => !p.is_host);
    if (!hostPlayer) {
      return sendError(res, "CONFLICT", "host player not found", 409);
    }
    const notReady = others.filter((p) => !p.is_ready);
    if (notReady.length > 0) {
      return sendError(res, "CONFLICT", "all non-host players must be ready", 409);
    }

    // TODO: countdown 종료 시점에 rooms.phase를 game 으로 바꾸고 games row 생성
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
    // eslint-disable-next-line no-console
    console.error("[roomsRouter][POST /rooms/:roomId/start] unexpected error:", err);
    sendError(res, "INTERNAL_ERROR", "failed to start game", 500);
  }
});

// 5.1 DELETE /rooms/{roomId}
roomsRouter.delete("/:roomId", requireRoomAuth, requireHost, async (req, res) => {
  const roomId = req.auth!.roomId;

  try {
    const { error } = await supabase.from("rooms").delete().eq("id", roomId);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[supabase][delete room] error:", error);
      return sendError(res, "INTERNAL_ERROR", "failed to delete room", 500);
    }

    sendOk(res, { deleted: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[roomsRouter][DELETE /rooms/:roomId] unexpected error:", err);
    sendError(res, "INTERNAL_ERROR", "failed to delete room", 500);
  }
});

type RoomSettingsInput = Record<string, any>;

function validateRoomSettings(
  raw: RoomSettingsInput,
): { ok: true; value: RoomSettingsInput } | { ok: false; message?: string } {
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
  if (
    typeof fearReviveHp !== "number" ||
    fearReviveHp < 1 ||
    fearReviveHp > 3
  ) {
    return { ok: false, message: "invalid fearReviveHp" };
  }
  if (
    typeof trollSurviveSec !== "number" ||
    trollSurviveSec <= 0
  ) {
    return { ok: false, message: "invalid trollSurviveSec" };
  }

  const traitor = teamCounts.traitor ?? 1;
  const hero = teamCounts.hero ?? 3;
  const civil = teamCounts.civil ?? 1;
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

