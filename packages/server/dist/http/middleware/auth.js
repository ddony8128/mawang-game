"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoomAuth = requireRoomAuth;
exports.requireHost = requireHost;
const authService_1 = require("../../auth/authService");
const apiResponse_1 = require("../apiResponse");
function parseBearerToken(req) {
    const raw = req.header("authorization") ?? req.header("Authorization");
    if (!raw)
        return null;
    const header = Array.isArray(raw) ? raw[0] : raw;
    const parts = header.split(" ");
    if (parts.length !== 2)
        return null;
    if (!/^Bearer$/i.test(parts[0]))
        return null;
    return parts[1] || null;
}
function getRoomPlayerIdHeader(req) {
    const raw = req.header("x-room-player-id") ?? req.header("X-Room-Player-Id");
    if (!raw)
        return null;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return v && v.length > 0 ? v : null;
}
async function requireRoomAuth(req, res, next) {
    const roomId = req.params.roomId;
    const roomPlayerId = getRoomPlayerIdHeader(req);
    const sessionToken = parseBearerToken(req);
    if (!roomId || !roomPlayerId) {
        return (0, apiResponse_1.sendError)(res, "AUTH_REQUIRED", "authorization required", 401);
    }
    if (!sessionToken) {
        return (0, apiResponse_1.sendError)(res, "AUTH_REQUIRED", "authorization required", 401);
    }
    try {
        const verified = await (0, authService_1.verifyRoomSession)({
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
    }
    catch (err) {
        if (err instanceof authService_1.AuthError) {
            return (0, apiResponse_1.sendError)(res, err.code, err.message, err.status);
        }
        return (0, apiResponse_1.sendError)(res, "AUTH_INVALID", "failed to verify session", 401);
    }
}
function requireHost(req, res, next) {
    if (!req.auth) {
        return (0, apiResponse_1.sendError)(res, "AUTH_REQUIRED", "authorization required", 401);
    }
    if (!req.auth.isHost) {
        return (0, apiResponse_1.sendError)(res, "FORBIDDEN", "only host can perform this action", 403);
    }
    next();
}
