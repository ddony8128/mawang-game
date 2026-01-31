"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomRuntimeManager = exports.RoomRuntime = void 0;
const stubEngine_1 = require("../engine/stubEngine");
const timerRegistry_1 = require("../engine/timerRegistry");
const authService_1 = require("../auth/authService");
const fogger_1 = require("./fogger");
const gameSnapshotsRepo_1 = require("../db/gameSnapshotsRepo");
const initializer_1 = require("../engine/initializer");
// roomId 기준 런타임 관리
// - 각 연결(roomPlayerId) 과 GameEngine 을 보유
// - WS payload 를 EngineTask 로 변환하고 EngineOutput 을 다시 WS 메시지로 변환한다.
class RoomRuntime {
    roomId;
    engine;
    timerRegistry;
    connections = new Map();
    snapshot = null;
    snapshotIntervalId;
    // 엔진 출력 처리 중 중복 호출을 막기 위한 플래그
    isFlushingEngineOutputs = false;
    constructor(roomId, engine) {
        this.roomId = roomId;
        const timerRegistry = (0, timerRegistry_1.createTimerRegistry)((task) => {
            // 타이머 만료 등으로 EngineTask 가 enqueue 되었을 때마다
            // 즉시 엔진 루프를 한 번 돌려 출력까지 처리한다.
            this.engine.enqueue(task);
            this.flushEngineOutputs();
        });
        this.timerRegistry = timerRegistry;
        this.engine = engine ?? (0, stubEngine_1.createGameEngine)(timerRegistry);
        // 60초마다 현재 스냅샷을 DB에 저장
        this.snapshotIntervalId = setInterval(() => {
            if (!this.snapshot)
                return;
            const gameId = this.snapshot.ids.gameId;
            void (0, gameSnapshotsRepo_1.saveSnapshot)({
                gameId,
                snapshot: this.snapshot,
            }).catch((err) => {
                // eslint-disable-next-line no-console
                console.error("[RoomRuntime] failed to save snapshot:", err);
            });
        }, 60_000);
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
        // 다음 공통 드로우 타이머를 등록한다.
        if (snapshot.timers.nextDrawAtMs) {
            this.timerRegistry.scheduleAt(snapshot.timers.nextDrawAtMs, "CARD_DRAW", {
                roomId: this.roomId,
            });
        }
        // 약골(weakling) 플레이어들의 표시 HP 출렁임을 위한 타이머를 등록한다.
        for (const player of Object.values(snapshot.players)) {
            if (player.role === "weakling") {
                this.timerRegistry.scheduleIn(120_000, "WEAKLING_FAKE_HP_TICK", {
                    playerId: player.identity.playerId,
                });
            }
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
        // 컨텍스트 검증 통과 → accepted ack 전송
        this.sendJson(conn.socket, {
            type: "ack",
            payload: {
                actionId,
                accepted: true,
                applied: false,
            },
        });
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
        if (this.isFlushingEngineOutputs) {
            return;
        }
        this.isFlushingEngineOutputs = true;
        // 하나 이상 처리될 수 있으므로 루프
        try {
            let out;
            // eslint-disable-next-line no-cond-assign
            while ((out = this.engine.processLoop())) {
                if (!this.snapshot) {
                    continue;
                }
                const snapshot = this.snapshot;
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
                // delta 를 FoggedGameState patch 로 변환해 patch 이벤트로 per-player 로 전송
                if (out.delta) {
                    const baseSnapshotVersion = snapshot.meta.snapshotVersion;
                    // 1) 서버 스냅샷에 delta 반영
                    if (out.delta.public?.players) {
                        for (const p of out.delta.public.players) {
                            const ps = snapshot.players[p.playerId];
                            if (ps) {
                                ps.hp = p.hp;
                                ps.alive = p.alive;
                            }
                        }
                    }
                    if (typeof out.delta.public?.nextDrawAtMs === "number") {
                        snapshot.timers.nextDrawAtMs = out.delta.public.nextDrawAtMs;
                    }
                    // snapshotVersion 증가
                    snapshot.meta.snapshotVersion += 1;
                    const nextSnapshotVersion = snapshot.meta.snapshotVersion;
                    // 2) 각 viewer 기준 FoggedGameState patch 생성 및 전송
                    const publicPlayersPatch = out.delta.public?.players?.map((p) => ({
                        playerId: p.playerId,
                        alive: p.alive,
                        hp: p.hp,
                    })) ?? [];
                    const privateByPlayer = out.delta.privateByPlayer ?? {};
                    for (const state of this.connections.values()) {
                        const viewerId = state.roomPlayerId;
                        const priv = privateByPlayer[viewerId];
                        const patch = {};
                        if (publicPlayersPatch.length > 0) {
                            patch.players = publicPlayersPatch;
                        }
                        // nextDrawAtMs / nowMs / state 등 메타 정보는 공통
                        patch.meta = {
                            state: snapshot.meta.state,
                            nowMs: snapshot.timers.nowMs,
                        };
                        patch.timers = {
                            nextDrawAtMs: snapshot.timers.nextDrawAtMs,
                        };
                        let logItems = [];
                        if (priv) {
                            // stateChanged 가 true 이면 전체 me subtree 를 새로 계산해 replace
                            if (priv.stateChanged) {
                                const fogged = (0, fogger_1.createFoggedState)(snapshot, viewerId);
                                patch.me = fogged.me;
                            }
                            if (priv.logItems && priv.logItems.length > 0) {
                                // Engine 의 LogItem 을 FoggedLogItem 으로 얕게 매핑
                                logItems = priv.logItems.map((item) => ({
                                    id: item.id,
                                    seq: item.seq,
                                    atMs: item.atMs,
                                    type: item.type,
                                    payload: item.payload,
                                    modal: item.modal,
                                }));
                            }
                        }
                        this.sendJson(state.socket, {
                            type: "patch",
                            payload: {
                                baseSnapshotVersion,
                                nextSnapshotVersion,
                                patch,
                                logItems,
                            },
                        });
                    }
                }
                // endState 가 있으면 end 이벤트 전송 및 RoomRuntime 정리
                if (out.endState) {
                    void (0, gameSnapshotsRepo_1.recordGameEnd)(out.endState).catch((err) => {
                        // eslint-disable-next-line no-console
                        console.error("[RoomRuntime] failed to record game end:", err);
                    });
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
        finally {
            this.isFlushingEngineOutputs = false;
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
    // ping 전송 및 타임아웃 강제 사망 처리
    sendPingAndCheckTimeout(nowMs) {
        for (const state of this.connections.values()) {
            // ping 전송
            this.sendJson(state.socket, {
                type: "ping",
                payload: {
                    pingId: `${state.roomPlayerId}-${nowMs}`,
                    serverTs: nowMs,
                },
            });
            state.missCount += 1;
            if (state.missCount >= 10) {
                // 5분 동안 pong 이 없으면 타임아웃 사망 처리
                this.engine.enqueue({
                    kind: "SYSTEM_TASK",
                    atMs: nowMs,
                    type: "FORCE_DEAD_BY_TIMEOUT",
                    playerId: state.roomPlayerId,
                });
                this.flushEngineOutputs();
                try {
                    state.socket.close();
                }
                catch {
                    // ignore
                }
                this.connections.delete(state.roomPlayerId);
            }
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
    pingIntervalId;
    // 방별 초기 스냅샷 생성이 동시에 여러 번 일어나는 것을 방지하기 위한 플래그/프로미스 맵
    // - 동일 roomId 에 대해 최초 1회만 createInitialSnapshotForRoom 을 수행하고
    // - 이후 ready 메시지는 해당 프로미스를 공유해 await 한다.
    initialSnapshotPromises = new Map();
    constructor() {
        // 30초마다 ping 을 보내고 pong 미수신 시 missCount 를 증가시킨다.
        this.pingIntervalId = setInterval(() => {
            const now = Date.now();
            for (const room of this.rooms.values()) {
                room["sendPingAndCheckTimeout"] &&
                    room.sendPingAndCheckTimeout(now);
            }
        }, 30_000);
    }
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
            // 로그: ready 메시지 처리 시작
            // eslint-disable-next-line no-console
            console.log(`[RoomRuntimeManager] Received "ready" message from socket`, {
                roomId,
                roomPlayerId,
                sessionToken: sessionToken ? "[REDACTED]" : undefined,
            });
            try {
                // 로그: 세션 검증 시작
                // eslint-disable-next-line no-console
                console.log(`[RoomRuntimeManager] Verifying room session...`, {
                    roomId,
                    roomPlayerId,
                });
                const verified = await (0, authService_1.verifyRoomSession)({ roomId, roomPlayerId, sessionToken });
                // 로그: 세션 검증 성공
                // eslint-disable-next-line no-console
                console.log(`[RoomRuntimeManager] Session verified`, {
                    roomId: verified.roomId,
                    roomPlayerId: verified.roomPlayerId,
                    isHost: verified.isHost,
                });
                const room = this.getOrCreateRoom(roomId);
                // 로그: RoomRuntime 인스턴스 준비, 연결 첨부
                // eslint-disable-next-line no-console
                console.log(`[RoomRuntimeManager] Attaching connection for`, {
                    roomId: verified.roomId,
                    roomPlayerId: verified.roomPlayerId,
                    isHost: verified.isHost,
                });
                room.attachConnection({
                    socket,
                    roomId: verified.roomId,
                    roomPlayerId: verified.roomPlayerId,
                    isHost: verified.isHost,
                    missCount: 0,
                    lastPongAtMs: Date.now(),
                });
                // 스냅샷 존재 여부 검사 및 필요시 생성
                let snapshot = room.getSnapshot();
                // 로그: room.getSnapshot() 결과
                // eslint-disable-next-line no-console
                console.log(`[RoomRuntimeManager] Room snapshot fetched`, {
                    exists: !!snapshot,
                    roomId: verified.roomId,
                });
                if (!snapshot) {
                    // 동일 roomId 에 대해 초기 스냅샷이 동시에 여러 번 생성되지 않도록
                    // 프로미스를 공유한다.
                    let initPromise = this.initialSnapshotPromises.get(roomId);
                    if (!initPromise) {
                        // 로그: 초기 스냅샷 최초 생성 시도
                        // eslint-disable-next-line no-console
                        console.log(`[RoomRuntimeManager] Creating initial snapshot for room (first time)`, {
                            roomId: verified.roomId,
                        });
                        initPromise = (async () => {
                            const created = await (0, initializer_1.createInitialSnapshotForRoom)(roomId);
                            if (!created)
                                return null;
                            room.setSnapshot(created);
                            // 로그: 초기 스냅샷 생성 성공, DB 저장 시도
                            // eslint-disable-next-line no-console
                            console.log(`[RoomRuntimeManager] Saving initial snapshot to DB`, {
                                gameId: created.ids.gameId,
                                roomId: verified.roomId,
                            });
                            try {
                                await (0, gameSnapshotsRepo_1.saveSnapshot)({
                                    gameId: created.ids.gameId,
                                    snapshot: created,
                                });
                                // 로그: DB 저장 성공
                                // eslint-disable-next-line no-console
                                console.log(`[RoomRuntimeManager] Successfully saved initial snapshot to DB`, {
                                    gameId: created.ids.gameId,
                                });
                            }
                            catch (err) {
                                // eslint-disable-next-line no-console
                                console.error("[RoomRuntimeManager] Failed to save initial snapshot:", err);
                            }
                            return created;
                        })();
                        this.initialSnapshotPromises.set(roomId, initPromise);
                    }
                    else {
                        // eslint-disable-next-line no-console
                        console.log(`[RoomRuntimeManager] Waiting for in-progress initial snapshot for room`, { roomId: verified.roomId });
                    }
                    snapshot = await initPromise;
                    this.initialSnapshotPromises.delete(roomId);
                    if (!snapshot) {
                        // 로그: running 게임 정보 없음
                        // eslint-disable-next-line no-console
                        console.warn(`[RoomRuntimeManager] No running game found for room`, {
                            roomId,
                        });
                        this.sendError(socket, {
                            code: "GAME_NOT_FOUND",
                            message: "no running game found for this room",
                            recoverable: false,
                            next: "go_lobby",
                        });
                        socket.close();
                        return;
                    }
                }
                // 엔진 스냅샷이 있으면 fogged snapshot 전송
                if (snapshot) {
                    // 로그: fogged snapshot 생성 시작
                    // eslint-disable-next-line no-console
                    console.log(`[RoomRuntimeManager] Creating and sending fogged snapshot to player`, {
                        roomId: verified.roomId,
                        roomPlayerId: verified.roomPlayerId,
                    });
                    const fogged = (0, fogger_1.createFoggedState)(snapshot, verified.roomPlayerId);
                    const msgReady = {
                        type: "snapshot",
                        payload: { state: fogged },
                    };
                    try {
                        socket.send(JSON.stringify(msgReady));
                        // 로그: fogged snapshot 전송 성공
                        // eslint-disable-next-line no-console
                        console.log(`[RoomRuntimeManager] Sent fogged snapshot to player`, {
                            roomId: verified.roomId,
                            roomPlayerId: verified.roomPlayerId,
                        });
                    }
                    catch (e) {
                        // 로그: fogged snapshot 전송 실패
                        // eslint-disable-next-line no-console
                        console.error(`[RoomRuntimeManager] Failed to send fogged snapshot to player`, {
                            roomId: verified.roomId,
                            roomPlayerId: verified.roomPlayerId,
                            error: e,
                        });
                    }
                }
                // 로그: ready 프로세스 정상 완료
                // eslint-disable-next-line no-console
                console.log(`[RoomRuntimeManager] Finished handling "ready" message for`, {
                    roomId: verified.roomId,
                    roomPlayerId: verified.roomPlayerId,
                });
                return;
            }
            catch (err) {
                // 로그: 예외 발생
                // eslint-disable-next-line no-console
                console.error("[RoomRuntimeManager] Error handling 'ready' message", {
                    roomId,
                    roomPlayerId,
                    error: err,
                });
                if (err instanceof authService_1.AuthError) {
                    // 로그: 인증 실패
                    // eslint-disable-next-line no-console
                    console.warn(`[RoomRuntimeManager] Auth failed for player`, {
                        roomId,
                        roomPlayerId,
                        error: err,
                    });
                    this.sendError(socket, {
                        code: "AUTH_FAILED",
                        message: err.message,
                        recoverable: false,
                        next: "go_lobby",
                    });
                }
                else {
                    // 로그: 기타 인증 오류
                    // eslint-disable-next-line no-console
                    console.warn(`[RoomRuntimeManager] Failed to verify session`, {
                        roomId,
                        roomPlayerId,
                        error: err,
                    });
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
            const snapshot = room.getSnapshot();
            const actorPlayerId = payload.actorPlayerId;
            if (!snapshot || snapshot.meta.state !== "running") {
                this.sendError(socket, {
                    code: "GAME_NOT_RUNNING",
                    message: "game is not running",
                    recoverable: false,
                    next: "go_lobby",
                });
                return;
            }
            if (!actorPlayerId || !snapshot.players[actorPlayerId]) {
                this.sendError(socket, {
                    code: "NOT_IN_GAME",
                    message: "player not in game snapshot",
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
