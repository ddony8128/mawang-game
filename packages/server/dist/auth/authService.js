"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthError = void 0;
exports.verifyRoomSession = verifyRoomSession;
const supabase_1 = require("../db/supabase");
const tokenHash_1 = require("./tokenHash");
class AuthError extends Error {
    code;
    status;
    constructor(code, message, status = 401) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
exports.AuthError = AuthError;
async function verifyRoomSession(params) {
    const { roomId, roomPlayerId, sessionToken } = params;
    if (!sessionToken) {
        throw new AuthError("AUTH_REQUIRED", "session token is required", 401);
    }
    const hashed = (0, tokenHash_1.hashSessionToken)(sessionToken);
    const { data, error } = await supabase_1.supabase
        .from("room_players")
        .select("id, room_id, is_host, is_in_room, device_id, session_token_hash")
        .eq("id", roomPlayerId)
        .eq("room_id", roomId)
        .single();
    if (error || !data) {
        throw new AuthError("AUTH_INVALID", "session not found", 401);
    }
    if (!data.is_in_room) {
        throw new AuthError("FORBIDDEN", "player is not in room", 403);
    }
    if (!data.session_token_hash || data.session_token_hash !== hashed) {
        throw new AuthError("AUTH_INVALID", "invalid session token", 401);
    }
    return {
        roomId,
        roomPlayerId,
        isHost: Boolean(data.is_host),
        deviceId: data.device_id ?? null,
    };
}
