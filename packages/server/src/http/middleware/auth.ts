import type { NextFunction, Request, Response } from "express";

import { AuthError, verifyRoomSession } from "../../auth/authService";
import { sendError } from "../apiResponse";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        roomId: string;
        roomPlayerId: string;
        sessionToken: string;
        isHost: boolean;
      };
    }
  }
}

function parseBearerToken(req: Request): string | null {
  const raw = req.header("authorization") ?? req.header("Authorization");
  if (!raw) return null;
  const header = Array.isArray(raw) ? raw[0] : raw;
  const parts = header.split(" ");
  if (parts.length !== 2) return null;
  if (!/^Bearer$/i.test(parts[0])) return null;
  return parts[1] || null;
}

function getRoomPlayerIdHeader(req: Request): string | null {
  const raw = req.header("x-room-player-id") ?? req.header("X-Room-Player-Id");
  if (!raw) return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.length > 0 ? v : null;
}

export async function requireRoomAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const roomId: string = req.params.roomId as string;
  const roomPlayerId = getRoomPlayerIdHeader(req);
  const sessionToken = parseBearerToken(req);

  if (!roomId || !roomPlayerId) {
    return sendError(res, "AUTH_REQUIRED", "authorization required", 401);
  }
  if (!sessionToken) {
    return sendError(res, "AUTH_REQUIRED", "authorization required", 401);
  }

  try {
    const verified = await verifyRoomSession({
      roomId,
      roomPlayerId,
      sessionToken,
    });
    req.auth = {
      roomId: verified.roomId,
      roomPlayerId: verified.roomPlayerId,
      sessionToken,
      isHost: verified.isHost,
    };
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      return sendError(res, err.code, err.message, err.status);
    }
    return sendError(res, "AUTH_INVALID", "failed to verify session", 401);
  }
}

export function requireHost(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return sendError(res, "AUTH_REQUIRED", "authorization required", 401);
  }
  if (!req.auth.isHost) {
    return sendError(res, "FORBIDDEN", "only host can perform this action", 403);
  }
  next();
}

