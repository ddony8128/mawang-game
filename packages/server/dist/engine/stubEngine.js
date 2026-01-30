"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StubGameEngine = void 0;
exports.createStubGameEngine = createStubGameEngine;
const crypto_1 = __importDefault(require("crypto"));
function ensurePrivateUpdate(map, playerId) {
    let update = map.get(playerId);
    if (!update) {
        update = {};
        map.set(playerId, update);
    }
    return update;
}
function markStateChanged(map, player) {
    const update = ensurePrivateUpdate(map, player.identity.playerId);
    update.stateChanged = true;
}
function appendLogItem(log, partial) {
    const id = crypto_1.default.randomUUID();
    const seq = log.lastSeq + 1;
    const item = {
        id,
        seq,
        ...partial,
    };
    log.lastSeq = seq;
    log.items.push(item);
    return item;
}
// CoreGameLogicDesign 기반 기본 엔진 구현.
// - EngineTask 큐를 직렬 처리하고
// - HP/사망/손패 일부 규칙을 적용해 appliedAck / invalid_action / delta 를 생성한다.
// 아직 모든 카드/역할/타이머를 다루지는 않지만, 이후 확장 가능한 뼈대를 제공한다.
class StubGameEngine {
    queue = [];
    state = null;
    timerRegistry;
    constructor(timerRegistry) {
        this.timerRegistry = timerRegistry;
    }
    // 추후 RoomRuntime 가 초기 GameSnapshot 을 로딩한 뒤 주입해 사용한다.
    setState(snapshot) {
        this.state = snapshot;
    }
    getState() {
        return this.state;
    }
    getNowMs() {
        if (this.timerRegistry)
            return this.timerRegistry.nowMs();
        if (this.state)
            return this.state.timers.nowMs;
        return Date.now();
    }
    enqueue(task) {
        this.queue.push(task);
    }
    processLoop() {
        if (this.queue.length === 0)
            return null;
        const appliedAcks = [];
        const invalidActions = [];
        // 간단한 delta: HP/생존 정보 + 개인 상태 변경 신호만 포함
        const publicPlayerUpdates = new Map();
        const privateUpdates = new Map();
        while (this.queue.length > 0) {
            const task = this.queue.shift();
            if (task.kind === "PLAYER_ACTION") {
                this.handlePlayerAction(task, {
                    appliedAcks,
                    invalidActions,
                    publicPlayerUpdates,
                    privateUpdates,
                });
            }
            else if (task.kind === "INTERNAL_TASK") {
                this.handleInternalTask(task, { publicPlayerUpdates, privateUpdates });
            }
            else if (task.kind === "SYSTEM_TASK") {
                this.handleSystemTask(task, { publicPlayerUpdates });
            }
            else if (task.kind === "TIMER_FIRED") {
                this.handleTimerFired(task, { publicPlayerUpdates, privateUpdates });
            }
        }
        if (appliedAcks.length === 0 &&
            invalidActions.length === 0 &&
            publicPlayerUpdates.size === 0 &&
            privateUpdates.size === 0) {
            // 의미 있는 출력이 없으면 null 로 처리
            return null;
        }
        const deltaPlayers = publicPlayerUpdates.size > 0
            ? Array.from(publicPlayerUpdates.values())
            : undefined;
        let delta;
        if (deltaPlayers || privateUpdates.size > 0) {
            const publicDelta = {};
            if (deltaPlayers) {
                publicDelta.players = deltaPlayers;
            }
            const privateByPlayer = privateUpdates.size > 0
                ? Object.fromEntries(privateUpdates.entries())
                : undefined;
            delta = {
                public: publicDelta,
                privateByPlayer,
            };
        }
        const output = {
            appliedAcks: appliedAcks.length > 0 ? appliedAcks : undefined,
            invalidActions: invalidActions.length > 0 ? invalidActions : undefined,
            delta,
        };
        return output;
    }
    handlePlayerAction(task, ctx) {
        const { actionId, actorPlayerId, actionType, data } = task;
        if (!this.state || this.state.meta.state !== "running") {
            ctx.invalidActions.push({
                actionId,
                playerId: actorPlayerId,
                code: "GAME_NOT_RUNNING",
                message: "game is not running",
            });
            return;
        }
        const actor = this.state.players[actorPlayerId];
        if (!actor) {
            ctx.invalidActions.push({
                actionId,
                playerId: actorPlayerId,
                code: "NOT_IN_GAME",
                message: "player not found in game",
            });
            return;
        }
        if (!actor.alive) {
            ctx.invalidActions.push({
                actionId,
                playerId: actorPlayerId,
                code: "YOU_ARE_DEAD",
                message: "you are dead",
            });
            return;
        }
        // 겁주기 효과에 걸려 있으면 어떤 행동도 불가
        const nowMs = this.getNowMs();
        const feared = actor.effects.find((e) => e.kind === "feared" && e.payload?.untilMs > nowMs);
        if (feared) {
            ctx.invalidActions.push({
                actionId,
                playerId: actorPlayerId,
                code: "EFFECT_BLOCKED",
                message: "you are feared and cannot act",
            });
            return;
        }
        // 손패 초과 시 discard 만 허용
        const handLimit = this.state.settings.handLimit;
        const mustDiscard = actor.hand.length > handLimit;
        if (mustDiscard && actionType !== "discard") {
            ctx.invalidActions.push({
                actionId,
                playerId: actorPlayerId,
                code: "HAND_LIMIT_EXCEEDED_MUST_DISCARD",
                message: "you must discard before other actions",
            });
            return;
        }
        switch (actionType) {
            case "card_use":
                this.handleCardUse(actionId, actor, data, ctx);
                break;
            case "discard":
                this.handleDiscard(actionId, actor, data, ctx);
                break;
            case "card_give":
                this.handleCardGive(actionId, actor, data, ctx);
                break;
            case "ability":
                this.handleAbility(actionId, actor, data, ctx);
                break;
            default:
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "RULE_VIOLATION",
                    message: "unknown action type",
                });
                return;
        }
        if (!ctx.invalidActions.some((ia) => ia.actionId === actionId) &&
            !ctx.appliedAcks.some((aa) => aa.actionId === actionId)) {
            ctx.appliedAcks.push({
                actionId,
                playerId: actor.identity.playerId,
            });
        }
    }
    handleCardUse(actionId, actor, data, ctx) {
        if (!this.state) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "GAME_NOT_RUNNING",
                message: "game is not running",
            });
            return;
        }
        const cardTypeFromPayload = data?.cardType;
        const cardInstanceIdsRaw = data?.cardInstanceIds;
        const primaryInstanceId = data?.cardInstanceId;
        const targetPlayerId = data?.targetPlayerId ?? null;
        let cardInstanceIds = [];
        if (Array.isArray(cardInstanceIdsRaw)) {
            cardInstanceIds = cardInstanceIdsRaw.filter((v) => typeof v === "string");
        }
        if (cardInstanceIds.length === 0 && typeof primaryInstanceId === "string") {
            cardInstanceIds = [primaryInstanceId];
        }
        if (cardInstanceIds.length === 0) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "BAD_INPUT",
                message: "cardInstanceId or cardInstanceIds are required",
            });
            return;
        }
        const mainInstanceId = cardInstanceIds[0];
        const handIndex = actor.hand.findIndex((c) => c.id === mainInstanceId);
        if (handIndex === -1) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "CARD_NOT_OWNED",
                message: "card not in hand",
            });
            return;
        }
        const card = actor.hand[handIndex];
        // payload 로 넘어온 cardType 과 실제 인스턴스 타입이 다르면 위조 시도로 간주
        if (cardTypeFromPayload && cardTypeFromPayload !== card.type) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "CARD_TYPE_MISMATCH",
                message: "cardType does not match card instance",
            });
            return;
        }
        // 겁쟁이: 카드 사용 시 50% 확률로 실패 (카드만 소모, 효과 없음)
        const isCoward = this.state.players[actor.identity.playerId]?.role === "coward";
        if (isCoward) {
            const r = this.nextRandom01();
            if (r < 0.5) {
                // 카드만 소모하고 효과는 적용하지 않는다.
                actor.hand.splice(handIndex, 1);
                markStateChanged(ctx.privateUpdates, actor);
                // 개인 로그 추가
                const logItem = appendLogItem(this.state.log, {
                    atMs: this.getNowMs(),
                    type: "PERSONAL_COWARD_CARD_FAILED",
                    audience: { kind: "player", playerId: actor.identity.playerId },
                    payload: {
                        cardType: card.type,
                    },
                    modal: true,
                });
                const update = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
                if (!update.logItems)
                    update.logItems = [];
                update.logItems.push(logItem);
                return;
            }
        }
        // 카드 타입별 처리
        if (card.type === "knife") {
            if (cardInstanceIds.length !== 1) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "BAD_INPUT",
                    message: "knife must use exactly one cardInstanceId",
                });
                return;
            }
            if (!targetPlayerId) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "INVALID_TARGET",
                    message: "targetPlayerId is required for knife",
                });
                return;
            }
            const target = this.state.players[targetPlayerId];
            if (!target) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "INVALID_TARGET",
                    message: "target not found",
                });
                return;
            }
            if (!target.alive) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "TARGET_DEAD",
                    message: "target is dead",
                });
                return;
            }
            // 단순 1 데미지 처리 (사망 연쇄/승리 조건은 INTERNAL_TASK 로 분리)
            this.enqueueInternalTask("APPLY_DAMAGE", {
                playerId: target.identity.playerId,
                amount: 1,
                cause: { type: "knife", byPlayerId: actor.identity.playerId },
            });
            // 로그: 칼 사용/피격
            const now = this.getNowMs();
            const usedLog = appendLogItem(this.state.log, {
                atMs: now,
                type: "PERSONAL_CARD_USED",
                audience: { kind: "player", playerId: actor.identity.playerId },
                payload: {
                    cardType: "knife",
                    targetPlayerId,
                },
                modal: false,
            });
            const hitLog = appendLogItem(this.state.log, {
                atMs: now,
                type: "PERSONAL_HIT_BY_KNIFE",
                audience: { kind: "player", playerId: target.identity.playerId },
                payload: {
                    byPlayerId: actor.identity.playerId,
                    damage: 1,
                },
                modal: true,
            });
            const actorUpdate = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
            const targetUpdate = ensurePrivateUpdate(ctx.privateUpdates, target.identity.playerId);
            actorUpdate.logItems = [...(actorUpdate.logItems ?? []), usedLog];
            targetUpdate.logItems = [...(targetUpdate.logItems ?? []), hitLog];
            // 사용한 카드는 손패에서 제거
            actor.hand.splice(handIndex, 1);
            markStateChanged(ctx.privateUpdates, actor);
        }
        else if (card.type === "beer") {
            if (cardInstanceIds.length !== 1) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "BAD_INPUT",
                    message: "beer must use exactly one cardInstanceId",
                });
                return;
            }
            // 자기 자신 HP 1 회복 (최대 3) - INTERNAL_TASK 로 처리
            this.enqueueInternalTask("APPLY_HEAL", {
                playerId: actor.identity.playerId,
                amount: 1,
                cause: { type: "beer", byPlayerId: actor.identity.playerId },
            });
            const now = this.getNowMs();
            const usedLog = appendLogItem(this.state.log, {
                atMs: now,
                type: "PERSONAL_CARD_USED",
                audience: { kind: "player", playerId: actor.identity.playerId },
                payload: {
                    cardType: "beer",
                    targetPlayerId: actor.identity.playerId,
                },
                modal: false,
            });
            const actorUpdate = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
            actorUpdate.logItems = [...(actorUpdate.logItems ?? []), usedLog];
            // 사용한 카드는 손패에서 제거
            actor.hand.splice(handIndex, 1);
            markStateChanged(ctx.privateUpdates, actor);
        }
        else if (card.type === "bomb") {
            if (cardInstanceIds.length !== 1) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "BAD_INPUT",
                    message: "bomb must use exactly one cardInstanceId",
                });
                return;
            }
            if (!targetPlayerId) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "INVALID_TARGET",
                    message: "targetPlayerId is required for bomb",
                });
                return;
            }
            const target = this.state.players[targetPlayerId];
            if (!target) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "INVALID_TARGET",
                    message: "target not found",
                });
                return;
            }
            if (!target.alive) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "TARGET_DEAD",
                    message: "target is dead",
                });
                return;
            }
            const now = this.getNowMs();
            const delayMs = this.state.settings.bombDelaySec * 1000;
            const explodeAtMs = now + delayMs;
            const effectId = crypto_1.default.randomUUID();
            target.effects.push({
                id: effectId,
                kind: "bomb",
                createdAtMs: now,
                expiresAtMs: explodeAtMs,
                visibility: "self",
                source: {
                    byPlayerId: actor.identity.playerId,
                    byCardId: card.id,
                },
                payload: {
                    plantedBy: actor.identity.playerId,
                    explodeAtMs,
                    damage: 2,
                },
            });
            // 폭탄 타이머 예약 (TimerRegistry 가 주입된 경우에만)
            this.timerRegistry?.scheduleIn(delayMs, "BOMB_EXPLODE", {
                playerId: target.identity.playerId,
                bombId: effectId,
            });
            // 로그: 폭탄 설치 (시한/대미지)
            const plantedLog = appendLogItem(this.state.log, {
                atMs: now,
                type: "PERSONAL_BOMB_PLANTED_ON_ME",
                audience: { kind: "player", playerId: target.identity.playerId },
                payload: {
                    byPlayerId: actor.identity.playerId,
                    explodeAtMs,
                    damage: 2,
                },
                modal: true,
            });
            const usedLog = appendLogItem(this.state.log, {
                atMs: now,
                type: "PERSONAL_CARD_USED",
                audience: { kind: "player", playerId: actor.identity.playerId },
                payload: {
                    cardType: "bomb",
                    targetPlayerId: target.identity.playerId,
                },
                modal: false,
            });
            const actorUpdate = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
            const targetUpdate = ensurePrivateUpdate(ctx.privateUpdates, target.identity.playerId);
            actorUpdate.logItems = [...(actorUpdate.logItems ?? []), usedLog];
            targetUpdate.logItems = [...(targetUpdate.logItems ?? []), plantedLog];
            // 사용한 카드는 손패에서 제거
            actor.hand.splice(handIndex, 1);
            markStateChanged(ctx.privateUpdates, actor);
            markStateChanged(ctx.privateUpdates, target);
        }
        else if (card.type === "magnifier") {
            // 돋보기 2/3장 사용: cardInstanceIds 로 전달된 인스턴스를 정확히 2/3장 소모하고 know 를 갱신한다.
            const useMode = data?.useMode;
            const requiredCount = useMode === "magnifier2" ? 2 : useMode === "magnifier3" ? 3 : 0;
            if (requiredCount === 0) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "BAD_INPUT",
                    message: "invalid useMode for magnifier",
                });
                return;
            }
            if (!Array.isArray(cardInstanceIdsRaw)) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "BAD_INPUT",
                    message: "cardInstanceIds is required for magnifier2/3",
                });
                return;
            }
            if (cardInstanceIds.length !== requiredCount) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "NOT_ENOUGH_CARDS_FOR_MAGNIFIER",
                    message: `exactly ${requiredCount} magnifier cards are required`,
                });
                return;
            }
            const seen = new Set();
            for (const id of cardInstanceIds) {
                if (seen.has(id)) {
                    ctx.invalidActions.push({
                        actionId,
                        playerId: actor.identity.playerId,
                        code: "BAD_INPUT",
                        message: "duplicate cardInstanceId in magnifier list",
                    });
                    return;
                }
                seen.add(id);
            }
            for (const id of cardInstanceIds) {
                const inHand = actor.hand.find((c) => c.id === id);
                if (!inHand || inHand.type !== "magnifier") {
                    ctx.invalidActions.push({
                        actionId,
                        playerId: actor.identity.playerId,
                        code: "NOT_ENOUGH_CARDS_FOR_MAGNIFIER",
                        message: "not enough magnifier cards in hand",
                    });
                    return;
                }
            }
            if (!targetPlayerId) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "INVALID_TARGET",
                    message: "targetPlayerId is required for magnifier",
                });
                return;
            }
            const target = this.state.players[targetPlayerId];
            if (!target) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "INVALID_TARGET",
                    message: "target not found",
                });
                return;
            }
            const now = this.getNowMs();
            const usedIds = new Set(cardInstanceIds);
            // 손패에서 선택된 돋보기를 소모
            actor.hand = actor.hand.filter((c) => !usedIds.has(c.id));
            // knowledge 업데이트 (팀/역할)
            const byTarget = actor.knowledge.knownByTarget;
            const prev = byTarget[target.identity.playerId] ?? [];
            if (useMode === "magnifier2") {
                byTarget[target.identity.playerId] = [
                    ...prev,
                    {
                        kind: "team",
                        team: target.fake.fakeTeam ?? target.team,
                        obtainedAtMs: now,
                        by: "magnifier2",
                    },
                ];
            }
            else if (useMode === "magnifier3") {
                byTarget[target.identity.playerId] = [
                    ...prev,
                    {
                        kind: "role",
                        role: target.fake.fakeRole ?? target.role,
                        obtainedAtMs: now,
                        by: "magnifier3",
                    },
                ];
            }
            markStateChanged(ctx.privateUpdates, actor);
            const usedLog = appendLogItem(this.state.log, {
                atMs: now,
                type: "PERSONAL_CARD_USED",
                audience: { kind: "player", playerId: actor.identity.playerId },
                payload: {
                    cardType: "magnifier",
                    targetPlayerId: target.identity.playerId,
                    mode: useMode,
                },
                modal: false,
            });
            const actorUpdate = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
            actorUpdate.logItems = [...(actorUpdate.logItems ?? []), usedLog];
            // 로그/모달은 이후 delta.privateByPlayer.logItems 로 전달
            return;
        }
        else {
            // 아직 구현하지 않은 카드 타입
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "RULE_VIOLATION",
                message: `card type ${card.type} not implemented`,
            });
            return;
        }
    }
    handleDiscard(actionId, actor, data, ctx) {
        const ids = data?.cardInstanceIds;
        if (!Array.isArray(ids) || ids.length === 0) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "BAD_INPUT",
                message: "cardInstanceIds must be a non-empty array",
            });
            return;
        }
        const stringIds = ids.filter((v) => typeof v === "string");
        if (stringIds.length === 0) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "BAD_INPUT",
                message: "cardInstanceIds must contain string values",
            });
            return;
        }
        const idSet = new Set(stringIds);
        actor.hand = actor.hand.filter((c) => !idSet.has(c.id));
        markStateChanged(ctx.privateUpdates, actor);
    }
    handleCardGive(actionId, actor, data, ctx) {
        if (!this.state) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "GAME_NOT_RUNNING",
                message: "game is not running",
            });
            return;
        }
        const instanceId = data?.cardInstanceId;
        const toPlayerId = data?.toPlayerId;
        if (!instanceId || !toPlayerId) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "BAD_INPUT",
                message: "cardInstanceId and toPlayerId are required",
            });
            return;
        }
        const target = this.state.players[toPlayerId];
        if (!target) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "INVALID_TARGET",
                message: "target not found",
            });
            return;
        }
        if (!target.alive) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "TARGET_DEAD",
                message: "target is dead",
            });
            return;
        }
        const handIndex = actor.hand.findIndex((c) => c.id === instanceId);
        if (handIndex === -1) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "CARD_NOT_OWNED",
                message: "card not in hand",
            });
            return;
        }
        const card = actor.hand[handIndex];
        actor.hand.splice(handIndex, 1);
        target.hand.push(card);
        const now = this.getNowMs();
        const givenLog = appendLogItem(this.state.log, {
            atMs: now,
            type: "PERSONAL_CARD_GIVEN",
            audience: { kind: "player", playerId: actor.identity.playerId },
            payload: {
                cardType: card.type,
                toPlayerId: target.identity.playerId,
            },
            modal: false,
        });
        const receivedLog = appendLogItem(this.state.log, {
            atMs: now,
            type: "PERSONAL_CARD_RECEIVED",
            audience: { kind: "player", playerId: target.identity.playerId },
            payload: {
                cardType: card.type,
                fromPlayerId: actor.identity.playerId,
            },
            modal: false,
        });
        const giverUpdate = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
        const receiverUpdate = ensurePrivateUpdate(ctx.privateUpdates, target.identity.playerId);
        giverUpdate.logItems = [...(giverUpdate.logItems ?? []), givenLog];
        receiverUpdate.logItems = [...(receiverUpdate.logItems ?? []), receivedLog];
    }
    handleAbility(actionId, actor, data, ctx) {
        const skillKey = data?.skillKey;
        const targetPlayerId = data?.targetPlayerId ?? null;
        if (!skillKey) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "BAD_INPUT",
                message: "skillKey is required",
            });
            return;
        }
        if (!this.state) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "GAME_NOT_RUNNING",
                message: "game is not running",
            });
            return;
        }
        const now = this.getNowMs();
        const ensureTarget = () => {
            if (!targetPlayerId) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "INVALID_TARGET",
                    message: "targetPlayerId is required for this skill",
                });
                return null;
            }
            const target = this.state.players[targetPlayerId];
            if (!target) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "INVALID_TARGET",
                    message: "target not found",
                });
                return null;
            }
            if (!target.alive) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "TARGET_DEAD",
                    message: "target is dead",
                });
                return null;
            }
            return target;
        };
        const requireRole = (role) => {
            if (actor.role !== role) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "RULE_VIOLATION",
                    message: "skill cannot be used by this role",
                });
                return false;
            }
            return true;
        };
        const requireCooldown = (key, cooldownMs) => {
            const cd = this.findCooldown(actor, key);
            if (cd && cd.readyAtMs > now) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "COOLDOWN_NOT_READY",
                    message: "skill cooldown not ready",
                });
                return false;
            }
            this.setCooldown(actor, key, now + cooldownMs);
            return true;
        };
        // 정신병자: 능력은 실제로 발동되지 않고, 사용된 것처럼만 처리
        if (this.state.players[actor.identity.playerId]?.role === "madman") {
            const nowMs = this.getNowMs();
            const logItem = appendLogItem(this.state.log, {
                atMs: nowMs,
                type: "PERSONAL_SKILL_USED",
                audience: { kind: "player", playerId: actor.identity.playerId },
                payload: {
                    skillKey,
                    targetPlayerId,
                },
                modal: true,
            });
            const update = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
            update.logItems = [...(update.logItems ?? []), logItem];
            return;
        }
        // 힐러: 회복 마법
        if (skillKey === "healer_heal") {
            if (!requireRole("healer"))
                return;
            if (!requireCooldown("healer_heal", 180_000))
                return; // 3분
            const target = ensureTarget();
            if (!target)
                return;
            this.enqueueInternalTask("APPLY_HEAL", {
                playerId: target.identity.playerId,
                amount: 1,
                cause: { type: "healer_heal", byPlayerId: actor.identity.playerId },
            });
            const logItem = appendLogItem(this.state.log, {
                atMs: now,
                type: "PERSONAL_SKILL_USED",
                audience: { kind: "player", playerId: actor.identity.playerId },
                payload: {
                    skillKey: "healer_heal",
                    targetPlayerId,
                },
                modal: false,
            });
            const update = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
            update.logItems = [...(update.logItems ?? []), logItem];
            return;
        }
        // 패링맨: 무적방패
        if (skillKey === "parry_shield") {
            if (!requireRole("parryman"))
                return;
            if (!requireCooldown("parry_shield", 180_000))
                return;
            const durationMs = 60_000; // 1분
            const untilMs = now + durationMs;
            actor.effects.push({
                id: crypto_1.default.randomUUID(),
                kind: "shield",
                createdAtMs: now,
                expiresAtMs: untilMs,
                visibility: "self",
                source: {
                    byPlayerId: actor.identity.playerId,
                    bySkillKey: "parry_shield",
                },
                payload: {
                    untilMs,
                },
            });
            this.timerRegistry?.scheduleIn(durationMs, "EFFECT_EXPIRE", {
                playerId: actor.identity.playerId,
                effectKind: "shield",
            });
            const logItem = appendLogItem(this.state.log, {
                atMs: now,
                type: "PERSONAL_SKILL_USED",
                audience: { kind: "player", playerId: actor.identity.playerId },
                payload: {
                    skillKey: "parry_shield",
                },
                modal: false,
            });
            const update = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
            update.logItems = [...(update.logItems ?? []), logItem];
            return;
        }
        // 공포의 마왕: 겁주기
        if (skillKey === "mawang_fear") {
            if (!requireRole("mawang_fear"))
                return;
            if (!requireCooldown("mawang_fear", 180_000))
                return;
            const target = ensureTarget();
            if (!target)
                return;
            const durationMs = 120_000; // 2분
            const untilMs = now + durationMs;
            target.effects.push({
                id: crypto_1.default.randomUUID(),
                kind: "feared",
                createdAtMs: now,
                expiresAtMs: untilMs,
                visibility: "self",
                source: {
                    byPlayerId: actor.identity.playerId,
                    bySkillKey: "mawang_fear",
                },
                payload: {
                    by: actor.identity.playerId,
                    untilMs,
                },
            });
            this.timerRegistry?.scheduleIn(durationMs, "EFFECT_EXPIRE", {
                playerId: target.identity.playerId,
                effectKind: "feared",
            });
            const logItem = appendLogItem(this.state.log, {
                atMs: now,
                type: "PERSONAL_SKILL_USED",
                audience: { kind: "player", playerId: actor.identity.playerId },
                payload: {
                    skillKey: "mawang_fear",
                    targetPlayerId,
                },
                modal: false,
            });
            const update = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
            update.logItems = [...(update.logItems ?? []), logItem];
            return;
        }
        // 분탕의 마왕: 가면놀이 (1회)
        if (skillKey === "mawang_mask") {
            if (!requireRole("mawang_troll"))
                return;
            if (actor.fake.fakeRole) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "ONE_TIME_USED",
                    message: "mawang_mask already used",
                });
                return;
            }
            const fakeRole = data?.fakeRole;
            const fakeTeam = data?.fakeTeam;
            const fakeSide = data?.fakeSide;
            if (!fakeRole) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "BAD_INPUT",
                    message: "fakeRole is required for mawang_mask",
                });
                return;
            }
            actor.fake.fakeRole = fakeRole;
            if (fakeTeam)
                actor.fake.fakeTeam = fakeTeam;
            if (fakeSide)
                actor.fake.fakeSide = fakeSide;
            const logItem = appendLogItem(this.state.log, {
                atMs: now,
                type: "PERSONAL_SKILL_USED",
                audience: { kind: "player", playerId: actor.identity.playerId },
                payload: {
                    skillKey: "mawang_mask",
                },
                modal: false,
            });
            const update = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
            update.logItems = [...(update.logItems ?? []), logItem];
            return;
        }
        // 타락자: 술자리 권유
        if (skillKey === "traitor_beer") {
            if (!requireRole("fallen"))
                return;
            if (!requireCooldown("traitor_beer", 180_000))
                return;
            const target = ensureTarget();
            if (!target)
                return;
            const forNextDrawAtMs = this.state.timers.nextDrawAtMs;
            target.effects.push({
                id: crypto_1.default.randomUUID(),
                kind: "beerGuaranteed",
                createdAtMs: now,
                expiresAtMs: forNextDrawAtMs,
                visibility: "self_hidden",
                source: {
                    byPlayerId: actor.identity.playerId,
                    bySkillKey: "traitor_beer",
                },
                payload: {
                    forNextDrawAtMs,
                },
            });
            const logItem = appendLogItem(this.state.log, {
                atMs: now,
                type: "PERSONAL_SKILL_USED",
                audience: { kind: "player", playerId: actor.identity.playerId },
                payload: {
                    skillKey: "traitor_beer",
                    targetPlayerId,
                },
                modal: false,
            });
            const update = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
            update.logItems = [...(update.logItems ?? []), logItem];
            return;
        }
        // 슬레이어: 짱쎈 필살기 (1회)
        if (skillKey === "slayer_ult") {
            if (!requireRole("slayer"))
                return;
            const used = actor.effects.some((e) => e.kind === "slayerUltUsed");
            if (used) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "ONE_TIME_USED",
                    message: "slayer_ult already used",
                });
                return;
            }
            const target = ensureTarget();
            if (!target)
                return;
            actor.effects.push({
                id: crypto_1.default.randomUUID(),
                kind: "slayerUltUsed",
                createdAtMs: now,
                visibility: "public",
                payload: { used: true },
            });
            this.enqueueInternalTask("APPLY_DAMAGE", {
                playerId: target.identity.playerId,
                amount: 3,
                cause: {
                    type: "slayer_ult",
                    byPlayerId: actor.identity.playerId,
                },
            });
            const nowMs = this.getNowMs();
            const personal = appendLogItem(this.state.log, {
                atMs: nowMs,
                type: "PERSONAL_SKILL_USED",
                audience: { kind: "player", playerId: actor.identity.playerId },
                payload: {
                    skillKey: "slayer_ult",
                    targetPlayerId,
                },
                modal: false,
            });
            const global = appendLogItem(this.state.log, {
                atMs: nowMs,
                type: "GLOBAL_SLAYER_ULT_USED",
                audience: { kind: "global" },
                payload: {
                    byPlayerId: actor.identity.playerId,
                    targetPlayerId,
                    damage: 3,
                },
                modal: true,
            });
            const update = ensurePrivateUpdate(ctx.privateUpdates, actor.identity.playerId);
            update.logItems = [...(update.logItems ?? []), personal];
            // 글로벌 로그는 모든 플레이어에게 전달
            for (const p of Object.values(this.state.players)) {
                const u = ensurePrivateUpdate(ctx.privateUpdates, p.identity.playerId);
                u.logItems = [...(u.logItems ?? []), global];
            }
            return;
        }
        ctx.invalidActions.push({
            actionId,
            playerId: actor.identity.playerId,
            code: "RULE_VIOLATION",
            message: `skill ${skillKey} not implemented`,
        });
    }
    handleInternalTask(task, ctx) {
        if (!this.state)
            return;
        const now = this.getNowMs();
        if (task.type === "APPLY_DAMAGE") {
            const playerId = task.payload?.playerId;
            const amount = task.payload?.amount;
            if (!playerId || typeof amount !== "number" || amount <= 0)
                return;
            const player = this.state.players[playerId];
            if (!player || !player.alive)
                return;
            // shield 효과가 있으면 피해 무효 처리
            const hasShield = player.effects.some((e) => e.kind === "shield" && e.payload?.untilMs > now);
            if (hasShield) {
                return;
            }
            player.hp = Math.max(0, player.hp - amount);
            ctx.publicPlayerUpdates.set(player.identity.playerId, {
                playerId: player.identity.playerId,
                hp: player.hp,
                alive: player.alive,
            });
            if (player.hp <= 0 && player.alive) {
                this.enqueueInternalTask("PLAYER_DIED", {
                    playerId: player.identity.playerId,
                    cause: task.payload?.cause ?? { type: "damage" },
                });
            }
        }
        else if (task.type === "APPLY_HEAL") {
            const playerId = task.payload?.playerId;
            const amount = task.payload?.amount;
            if (!playerId || typeof amount !== "number" || amount <= 0)
                return;
            const player = this.state.players[playerId];
            if (!player)
                return;
            player.hp = Math.min(3, player.hp + amount);
            ctx.publicPlayerUpdates.set(player.identity.playerId, {
                playerId: player.identity.playerId,
                hp: player.hp,
                alive: player.alive,
            });
        }
        else if (task.type === "PLAYER_DIED") {
            const playerId = task.payload?.playerId;
            const player = this.state.players[playerId];
            if (!player)
                return;
            // 이미 처리된 사망이면 스킵
            if (!player.alive)
                return;
            // 역할별 사망 연쇄 처리
            if (player.role === "mawang_fear") {
                const used = player.effects.some((e) => e.kind === "fearReviveUsed");
                if (!used) {
                    // 공포의 재림: 한 번 부활
                    const reviveHp = this.state.settings.fearReviveHp ?? 3;
                    player.alive = true;
                    player.hp = reviveHp;
                    player.effects.push({
                        id: crypto_1.default.randomUUID(),
                        kind: "fearReviveUsed",
                        createdAtMs: now,
                        visibility: "public",
                        payload: { used: true },
                    });
                    ctx.publicPlayerUpdates.set(player.identity.playerId, {
                        playerId: player.identity.playerId,
                        hp: player.hp,
                        alive: player.alive,
                    });
                    // 전역 로그: 공포의 재림 발동
                    const global = appendLogItem(this.state.log, {
                        atMs: now,
                        type: "GLOBAL_FEAR_REVIVE_TRIGGERED",
                        audience: { kind: "global" },
                        payload: {
                            playerId: player.identity.playerId,
                        },
                        modal: true,
                    });
                    for (const p of Object.values(this.state.players)) {
                        const u = ensurePrivateUpdate(ctx.privateUpdates, p.identity.playerId);
                        u.logItems = [...(u.logItems ?? []), global];
                    }
                    return;
                }
            }
            else if (player.role === "mawang_troll") {
                const stubborn = player.effects.find((e) => e.kind === "trollStubborn");
                if (!stubborn) {
                    // 분탕의 집념: 일정 시간 동안 생존 유지
                    const durationMs = this.state.settings.trollSurviveSec * 1000;
                    const untilMs = now + durationMs;
                    player.alive = true;
                    if (player.hp <= 0) {
                        player.hp = 1;
                    }
                    player.effects.push({
                        id: crypto_1.default.randomUUID(),
                        kind: "trollStubborn",
                        createdAtMs: now,
                        expiresAtMs: untilMs,
                        visibility: "self",
                        payload: {
                            untilMs,
                            triggeredAtMs: now,
                        },
                    });
                    ctx.publicPlayerUpdates.set(player.identity.playerId, {
                        playerId: player.identity.playerId,
                        hp: player.hp,
                        alive: player.alive,
                    });
                    this.timerRegistry?.scheduleIn(durationMs, "EFFECT_EXPIRE", {
                        playerId: player.identity.playerId,
                        effectKind: "trollStubborn",
                    });
                    const global = appendLogItem(this.state.log, {
                        atMs: now,
                        type: "GLOBAL_TROLL_STUBBORN_TRIGGERED",
                        audience: { kind: "global" },
                        payload: {
                            playerId: player.identity.playerId,
                        },
                        modal: true,
                    });
                    for (const p of Object.values(this.state.players)) {
                        const u = ensurePrivateUpdate(ctx.privateUpdates, p.identity.playerId);
                        u.logItems = [...(u.logItems ?? []), global];
                    }
                    return;
                }
            }
            else if (player.role === "experiment_host") {
                // 실험체 사망: 악 팀 전원 카드 2장씩 드로우
                for (const p of Object.values(this.state.players)) {
                    if (p.team === "evil") {
                        this.drawCardsForPlayer(p, 2);
                        markStateChanged(ctx.privateUpdates, p);
                        const logItem = appendLogItem(this.state.log, {
                            atMs: now,
                            type: "EVIL_TEAM_EXPERIMENT_HOST_DIED_BONUS",
                            audience: { kind: "player", playerId: p.identity.playerId },
                            payload: {
                                hostPlayerId: player.identity.playerId,
                            },
                            modal: true,
                        });
                        const u = ensurePrivateUpdate(ctx.privateUpdates, p.identity.playerId);
                        u.logItems = [...(u.logItems ?? []), logItem];
                    }
                }
            }
            // 기본 사망 처리
            player.alive = false;
            player.hp = 0;
            ctx.publicPlayerUpdates.set(player.identity.playerId, {
                playerId: player.identity.playerId,
                hp: player.hp,
                alive: player.alive,
            });
            const diedLog = appendLogItem(this.state.log, {
                atMs: now,
                type: "PERSONAL_DIED",
                audience: { kind: "player", playerId: player.identity.playerId },
                payload: {},
                modal: true,
            });
            const u = ensurePrivateUpdate(ctx.privateUpdates, player.identity.playerId);
            u.logItems = [...(u.logItems ?? []), diedLog];
            // 이후 CHECK_END 로 승리 조건 검사
            this.enqueueInternalTask("CHECK_END", {});
        }
        else if (task.type === "CHECK_END") {
            this.checkEndCondition();
        }
    }
    handleSystemTask(task, ctx) {
        if (!this.state)
            return;
        if (task.type === "FORCE_DEAD_BY_TIMEOUT") {
            const player = this.state.players[task.playerId];
            if (!player)
                return;
            player.hp = 0;
            player.alive = false;
            ctx.publicPlayerUpdates.set(player.identity.playerId, {
                playerId: player.identity.playerId,
                hp: player.hp,
                alive: player.alive,
            });
            this.enqueueInternalTask("PLAYER_DIED", {
                playerId: player.identity.playerId,
                cause: { type: "timeout" },
            });
        }
    }
    handleTimerFired(task, ctx) {
        if (!this.state)
            return;
        const now = this.getNowMs();
        if (task.timerType === "CARD_DRAW") {
            // 살아있는 모든 플레이어에 카드 1장 드로우, 현자 예언/술자리 권유 반영
            for (const player of Object.values(this.state.players)) {
                if (!player.alive)
                    continue;
                // 술자리 권유(beerGuaranteed) 효과가 있으면 맥주 확정
                const beerIdx = player.effects.findIndex((e) => e.kind === "beerGuaranteed");
                let firstCardType;
                if (beerIdx >= 0) {
                    firstCardType = "beer";
                    player.effects.splice(beerIdx, 1);
                }
                else {
                    firstCardType = this.randomCardType();
                }
                const firstCard = this.createCardInstance(firstCardType, now);
                player.hand.push(firstCard);
                // 현자: 돋보기를 뽑으면 한 장 추가
                if (player.role === "sage" && firstCard.type === "magnifier") {
                    const extra = this.createCardInstance("magnifier", now);
                    player.hand.push(extra);
                }
                markStateChanged(ctx.privateUpdates, player);
            }
            // 다음 드로우 시각 갱신 및 타이머 재등록
            const intervalMs = this.state.settings.drawIntervalSec * 1000;
            this.state.timers.nowMs = now;
            this.state.timers.nextDrawAtMs = now + intervalMs;
            this.timerRegistry?.scheduleIn(intervalMs, "CARD_DRAW", {});
        }
        else if (task.timerType === "BOMB_EXPLODE") {
            const playerId = task.payload?.playerId;
            const bombId = task.payload?.bombId;
            if (!playerId || !bombId)
                return;
            const player = this.state.players[playerId];
            if (!player || !player.alive)
                return;
            const idx = player.effects.findIndex((e) => e.kind === "bomb" && e.id === bombId);
            if (idx === -1)
                return;
            const effect = player.effects[idx];
            player.effects.splice(idx, 1);
            markStateChanged(ctx.privateUpdates, player);
            const damage = effect.payload?.damage ?? 2;
            this.enqueueInternalTask("APPLY_DAMAGE", {
                playerId,
                amount: damage,
                cause: { type: "bomb", plantedBy: effect.payload?.plantedBy },
            });
            const nowMs = this.getNowMs();
            const logItem = appendLogItem(this.state.log, {
                atMs: nowMs,
                type: "PERSONAL_BOMB_EXPLODED_ON_ME",
                audience: { kind: "player", playerId },
                payload: {
                    damage,
                },
                modal: true,
            });
            const u = ensurePrivateUpdate(ctx.privateUpdates, playerId);
            u.logItems = [...(u.logItems ?? []), logItem];
        }
        else if (task.timerType === "EFFECT_EXPIRE") {
            const playerId = task.payload?.playerId;
            const effectKind = task.payload?.effectKind;
            if (!playerId || !effectKind)
                return;
            const player = this.state.players[playerId];
            if (!player)
                return;
            const idx = player.effects.findIndex((e) => e.kind === effectKind);
            if (idx === -1)
                return;
            const eff = player.effects[idx];
            player.effects.splice(idx, 1);
            markStateChanged(ctx.privateUpdates, player);
            // 분탕 집념 만료 시 최종 사망 처리
            if (eff.kind === "trollStubborn") {
                this.enqueueInternalTask("PLAYER_DIED", {
                    playerId: player.identity.playerId,
                    cause: { type: "troll_stubborn_expired" },
                });
            }
        }
        else if (task.timerType === "WEAKLING_FAKE_HP_TICK") {
            const playerId = task.payload?.playerId;
            if (!playerId)
                return;
            const player = this.state.players[playerId];
            if (!player || player.role !== "weakling")
                return;
            // fakeHp tick 분포:
            // - 시작: fakeHp=3
            // - 이후: 75% +0, 10% -1, 5% -2, 10% +1
            // - 결과가 3 초과면 3, 0 이하이면 1로 보정
            let currentFake = typeof player.fake.fakeHp === "number" ? player.fake.fakeHp : 3;
            const r = this.nextRandom01();
            let delta = 0;
            if (r < 0.75) {
                delta = 0;
            }
            else if (r < 0.85) {
                delta = -1;
            }
            else if (r < 0.9) {
                delta = -2;
            }
            else {
                delta = 1;
            }
            let nextFake = currentFake + delta;
            if (nextFake > 3)
                nextFake = 3;
            if (nextFake <= 0)
                nextFake = 1;
            player.fake.fakeHp = nextFake;
            markStateChanged(ctx.privateUpdates, player);
            // 다음 tick 예약 (2분)
            this.timerRegistry?.scheduleIn(120_000, "WEAKLING_FAKE_HP_TICK", {
                playerId,
            });
        }
    }
    checkEndCondition() {
        if (!this.state)
            return;
        const players = Object.values(this.state.players);
        const mawangAlive = players.some((p) => p.alive && this.isMawangRole(p.role));
        const heroesAlive = players.some((p) => p.alive && p.side === "hero");
        if (!mawangAlive) {
            this.state.meta.state = "ended";
            this.state.endState = {
                gameId: this.state.ids.gameId,
                roomId: this.state.ids.roomId,
                seq: this.state.ids.seq,
                endedAtMs: this.state.timers.nowMs,
                reason: "MAWANG_DEAD",
                results: players.map((p) => ({
                    playerId: p.identity.playerId,
                    nickname: p.identity.nickname,
                    win: !this.isMawangRole(p.role) && p.team === "good",
                    alive: p.alive,
                    role: p.role,
                    team: p.team,
                    side: p.side,
                })),
            };
            return;
        }
        if (!heroesAlive) {
            this.state.meta.state = "ended";
            this.state.endState = {
                gameId: this.state.ids.gameId,
                roomId: this.state.ids.roomId,
                seq: this.state.ids.seq,
                endedAtMs: this.state.timers.nowMs,
                reason: "ALL_HERO_DEAD",
                results: players.map((p) => ({
                    playerId: p.identity.playerId,
                    nickname: p.identity.nickname,
                    win: this.isMawangSideWinner(p),
                    alive: p.alive,
                    role: p.role,
                    team: p.team,
                    side: p.side,
                })),
            };
        }
    }
    isMawangRole(role) {
        return role === "mawang_fear" || role === "mawang_troll";
    }
    isMawangSideWinner(p) {
        // 마왕 + 배신자 승리: evil 팀 또는 traitor side 를 evil 승리로 처리
        return p.team === "evil" || p.side === "traitor";
    }
    enqueueInternalTask(type, payload) {
        this.enqueue({
            kind: "INTERNAL_TASK",
            atMs: this.getNowMs(),
            type,
            payload,
        });
    }
    nextRandom01() {
        if (!this.state)
            return Math.random();
        const { rng } = this.state;
        const hash = crypto_1.default.createHash("sha256");
        hash.update(rng.seed);
        hash.update(String(rng.counter));
        const digest = hash.digest();
        const a = digest.readUInt32BE(0);
        const b = digest.readUInt32BE(4);
        const combined = (a ^ b) >>> 0;
        rng.counter += 1;
        return combined / 0xffffffff;
    }
    randomCardType() {
        const r = this.nextRandom01();
        if (r < 0.25)
            return "magnifier";
        if (r < 0.5)
            return "knife";
        if (r < 0.75)
            return "bomb";
        return "beer";
    }
    createCardInstance(type, now) {
        return {
            id: crypto_1.default.randomUUID(),
            type,
            createdAtMs: now,
        };
    }
    drawCardsForPlayer(player, count) {
        const now = this.getNowMs();
        for (let i = 0; i < count; i += 1) {
            const type = this.randomCardType();
            const card = this.createCardInstance(type, now);
            player.hand.push(card);
        }
    }
    findCooldown(player, skillKey) {
        return player.cooldowns.find((c) => c.skillKey === skillKey);
    }
    setCooldown(player, skillKey, readyAtMs) {
        const existing = player.cooldowns.find((c) => c.skillKey === skillKey);
        if (existing) {
            existing.readyAtMs = readyAtMs;
        }
        else {
            player.cooldowns.push({ skillKey, readyAtMs });
        }
    }
}
exports.StubGameEngine = StubGameEngine;
function createStubGameEngine(timerRegistry) {
    return new StubGameEngine(timerRegistry);
}
