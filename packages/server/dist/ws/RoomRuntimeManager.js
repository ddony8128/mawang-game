"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomRuntimeManager = exports.RoomRuntime = void 0;
const stubEngine_1 = require("../engine/stubEngine");
const authService_1 = require("../auth/authService");
const fogger_1 = require("./fogger");
// roomId 기준 런타임 관리
// - 각 연결(roomPlayerId) 과 GameEngine 을 보유
// - WS payload 를 EngineTask 로 변환하고 EngineOutput 을 다시 WS 메시지로 변환한다.
class RoomRuntime {
    roomId;
    engine;
    connections = new Map();
    snapshot = null;
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
    setSnapshot(snapshot) {
        this.snapshot = snapshot;
        // 엔진에도 최신 상태를 주입한다(엔진이 지원하는 경우).
        if ("setState" in this.engine && typeof this.engine.setState === "function") {
            this.engine.setState(snapshot);
        }
    }
    getSnapshot() {
        return this.snapshot;
    }
    handlePong(socket, _payload) {
        for (const state of this.connections.values()) {
            if (state.socket === socket) {
                state.lastPongAtMs = Date.now();
                state.missCount = 0;
                break;
            }
        }
    }
    handleAction(socket, payload) {
        // payload 는 WsClientActionPayload 형태라고 가정한다.
        const { actionId, actorPlayerId, actionType, data } = payload ?? {};
        if (!actionId || !actorPlayerId || !actionType) {
            this.sendInvalidActionBySocket(socket, {
                actionId: actionId ?? "unknown",
                code: "BAD_INPUT",
                message: "invalid action payload",
            });
            return;
        }
        const conn = this.findConnectionBySocket(socket);
        if (!conn) {
            this.sendInvalidActionBySocket(socket, {
                actionId,
                code: "NOT_IN_GAME",
                message: "connection is not attached to this room",
            });
            return;
        }
        if (conn.roomPlayerId !== actorPlayerId) {
            this.sendInvalidActionBySocket(socket, {
                actionId,
                code: "RULE_VIOLATION",
                message: "actorPlayerId does not match current connection",
            });
            return;
        }
        // EngineTask 로 변환해 enqueue
        this.engine.enqueue({
            kind: "PLAYER_ACTION",
            actionId,
            atMs: Date.now(),
            actorPlayerId,
            actionType,
            data,
        });
        this.flushEngineOutputs();
    }
    broadcastSnapshot() {
        if (!this.snapshot)
            return;
        for (const state of this.connections.values()) {
            const fogged = (0, fogger_1.createFoggedState)(this.snapshot, state.roomPlayerId);
            this.sendJson(state.socket, {
                type: "snapshot",
                payload: { state: fogged },
            });
        }
    }
    // EngineOutput 을 WS 메시지로 변환
    flushEngineOutputs() {
        // 하나 이상 처리될 수 있으므로 루프
        // StubGameEngine 은 현재 delta/endState/dbEvents 를 채우지 않는다.
        // 이후 실제 구현에서 확장한다.
        let out;
        // eslint-disable-next-line no-cond-assign
        while ((out = this.engine.processLoop())) {
            if (out.appliedAcks) {
                for (const ack of out.appliedAcks) {
                    this.sendAck(ack.playerId, ack.actionId);
                }
            }
            if (out.invalidActions) {
                for (const inv of out.invalidActions) {
                    this.sendInvalidAction(inv.playerId, {
                        actionId: inv.actionId,
                        code: inv.code,
                        message: inv.message,
                    });
                }
            }
            // delta 를 FoggedGameState patch 로 변환해 patch 이벤트로 broadcast
            if (out.delta && this.snapshot) {
                // v1: public.players 만을 사용해 부분 players 업데이트만 보낸다.
                if (out.delta.public?.players && out.delta.public.players.length > 0) {
                    const playersPatch = out.delta.public.players.map((p) => ({
                        playerId: p.playerId,
                        alive: p.alive,
                        hp: p.hp,
                    }));
                    for (const state of this.connections.values()) {
                        this.sendJson(state.socket, {
                            type: "patch",
                            payload: {
                                baseSnapshotVersion: this.snapshot.meta.snapshotVersion,
                                nextSnapshotVersion: this.snapshot.meta.snapshotVersion + 1,
                                patch: {
                                    players: playersPatch,
                                },
                                logItems: [],
                            },
                        });
                    }
                    // 서버 스냅샷도 일관되게 업데이트
                    for (const p of out.delta.public.players) {
                        const ps = this.snapshot.players[p.playerId];
                        if (ps) {
                            ps.hp = p.hp;
                            ps.alive = p.alive;
                        }
                    }
                    this.snapshot.meta.snapshotVersion += 1;
                }
            }
            // endState 가 있으면 end 이벤트 전송 및 RoomRuntime 정리 (v1: WS 송신까지만 구현)
            if (out.endState) {
                for (const state of this.connections.values()) {
                    this.sendJson(state.socket, {
                        type: "end",
                        payload: { endState: out.endState },
                    });
                    state.socket.close();
                }
                this.connections.clear();
            }
            // dbEvents 는 이후 games/game_snapshots 조합으로 처리
        }
    }
    findConnectionBySocket(socket) {
        for (const state of this.connections.values()) {
            if (state.socket === socket)
                return state;
        }
        return undefined;
    }
    sendJson(socket, msg) {
        try {
            socket.send(JSON.stringify(msg));
        }
        catch {
            // ignore
        }
    }
    sendAck(playerId, actionId) {
        const conn = this.connections.get(playerId);
        if (!conn)
            return;
        this.sendJson(conn.socket, {
            type: "ack",
            payload: {
                actionId,
                accepted: true,
                applied: true,
            },
        });
    }
    sendInvalidAction(playerId, payload) {
        const conn = this.connections.get(playerId);
        if (!conn)
            return;
        this.sendJson(conn.socket, {
            type: "invalid_action",
            payload,
        });
    }
    sendInvalidActionBySocket(socket, payload) {
        this.sendJson(socket, {
            type: "invalid_action",
            payload,
        });
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
                // 엔진 스냅샷이 있으면 viewer 기준 fogged snapshot 을 내려준다.
                const snapshot = room.getSnapshot();
                if (snapshot) {
                    const fogged = (0, fogger_1.createFoggedState)(snapshot, verified.roomPlayerId);
                    const msgReady = {
                        type: "snapshot",
                        payload: { state: fogged },
                    };
                    try {
                        socket.send(JSON.stringify(msgReady));
                    }
                    catch {
                        // ignore
                    }
                }
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
            // 연결된 room 을 찾아 pong 반영
            for (const room of this.rooms.values()) {
                room.handlePong(socket, payload);
            }
            return;
        }
        if (type === "action" && payload) {
            const roomId = payload.roomId;
            if (!roomId) {
                this.sendError(socket, {
                    code: "BAD_MESSAGE",
                    message: "roomId is required for action",
                    recoverable: true,
                    next: "retry_ready",
                });
                return;
            }
            const room = this.rooms.get(roomId);
            if (!room) {
                this.sendError(socket, {
                    code: "GAME_NOT_FOUND",
                    message: "room runtime not found",
                    recoverable: false,
                    next: "go_lobby",
                });
                return;
            }
            room.handleAction(socket, payload);
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
