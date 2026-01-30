"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomRuntimeManager = exports.RoomRuntime = void 0;
const stubEngine_1 = require("../engine/stubEngine");
const authService_1 = require("../auth/authService");
// roomId 기준 런타임 관리 (v1: 매우 단순한 구조)
class RoomRuntime {
    roomId;
    engine;
    connections = new Map();
    constructor(roomId, engine) {
        this.roomId = roomId;
        this.engine = engine ?? (0, stubEngine_1.createStubGameEngine)();
    }
    attachConnection(state) {
        this.connections.set(state.roomPlayerId, state);
    }
    detachSocket(socket) {
        for (const [playerId, state] of this.connections) {
            if (state.socket === socket) {
                this.connections.delete(playerId);
                break;
            }
        }
    }
}
exports.RoomRuntime = RoomRuntime;
class RoomRuntimeManager {
    rooms = new Map();
    getOrCreateRoom(roomId) {
        let room = this.rooms.get(roomId);
        if (!room) {
            room = new RoomRuntime(roomId);
            this.rooms.set(roomId, room);
        }
        return room;
    }
    async handleRawMessage(socket, msg) {
        if (!msg || typeof msg !== "object")
            return;
        const { type, payload } = msg;
        if (type === "ready" && payload && typeof payload.roomId === "string") {
            const roomId = payload.roomId;
            const roomPlayerId = payload.roomPlayerId;
            const sessionToken = payload.sessionToken;
            try {
                const verified = await (0, authService_1.verifyRoomSession)({ roomId, roomPlayerId, sessionToken });
                const room = this.getOrCreateRoom(roomId);
                room.attachConnection({
                    socket,
                    roomId: verified.roomId,
                    roomPlayerId: verified.roomPlayerId,
                    isHost: verified.isHost,
                    missCount: 0,
                    lastPongAtMs: Date.now(),
                });
                // TODO: 엔진 상태를 fogging 해서 내려주는 부분은 이후 구현
                return;
            }
            catch (err) {
                if (err instanceof authService_1.AuthError) {
                    this.sendError(socket, {
                        code: "AUTH_FAILED",
                        message: err.message,
                        recoverable: false,
                        next: "go_lobby",
                    });
                }
                else {
                    this.sendError(socket, {
                        code: "AUTH_FAILED",
                        message: "failed to verify session",
                        recoverable: false,
                        next: "go_lobby",
                    });
                }
                socket.close();
                return;
            }
        }
        if (type === "pong" && payload && typeof payload.pingId === "string") {
            // TODO: ping/pong 기반 missCount 갱신은 이후 구현
            return;
        }
        if (type === "action") {
            // TODO: EngineTask 로 변환하여 엔진에 enqueue
            return;
        }
        if (type === "disconnect") {
            socket.close();
            return;
        }
    }
    handleSocketClosed(socket) {
        for (const room of this.rooms.values()) {
            room.detachSocket(socket);
        }
    }
    sendError(socket, payload) {
        const msg = {
            type: "error",
            payload,
        };
        try {
            socket.send(JSON.stringify(msg));
        }
        catch {
            // ignore
        }
    }
}
exports.RoomRuntimeManager = RoomRuntimeManager;
