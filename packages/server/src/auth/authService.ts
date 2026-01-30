import { supabase } from "../db/supabase";
import { hashSessionToken } from "./tokenHash";

export type VerifiedRoomSession = {
  roomId: string;
  roomPlayerId: string;
  isHost: boolean;
  deviceId: string | null;
};

export class AuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 401) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function verifyRoomSession(params: {
  roomId: string;
  roomPlayerId: string;
  sessionToken: string;
}): Promise<VerifiedRoomSession> {
  const { roomId, roomPlayerId, sessionToken } = params;

  if (!sessionToken) {
    throw new AuthError("AUTH_REQUIRED", "session token is required", 401);
  }

  const hashed = hashSessionToken(sessionToken);

  const { data, error } = await supabase
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
    deviceId: (data.device_id as string | null) ?? null,
  };
}

