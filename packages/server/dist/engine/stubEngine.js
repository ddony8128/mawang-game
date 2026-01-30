"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StubGameEngine = void 0;
exports.createStubGameEngine = createStubGameEngine;
// CoreGameLogicDesign 기반 기본 엔진 구현.
// - EngineTask 큐를 직렬 처리하고
// - HP/사망/손패 일부 규칙을 적용해 appliedAck / invalid_action / delta 를 생성한다.
// 아직 모든 카드/역할/타이머를 다루지는 않지만, 이후 확장 가능한 뼈대를 제공한다.
class StubGameEngine {
    queue = [];
    state = null;
    // 추후 RoomRuntime 가 초기 GameSnapshot 을 로딩한 뒤 주입해 사용한다.
    setState(snapshot) {
        this.state = snapshot;
    }
    getState() {
        return this.state;
    }
    enqueue(task) {
        this.queue.push(task);
    }
    processLoop() {
        if (this.queue.length === 0)
            return null;
        const appliedAcks = [];
        const invalidActions = [];
        // 간단한 delta: HP/생존 정보만 포함
        const publicPlayerUpdates = new Map();
        while (this.queue.length > 0) {
            const task = this.queue.shift();
            if (task.kind === "PLAYER_ACTION") {
                this.handlePlayerAction(task, { appliedAcks, invalidActions, publicPlayerUpdates });
            }
            // TIMER_FIRED, SYSTEM_TASK, INTERNAL_TASK 는
            // 이후 GameSnapshot/Effect 로직을 도입하면서 처리한다.
        }
        if (appliedAcks.length === 0 &&
            invalidActions.length === 0 &&
            publicPlayerUpdates.size === 0) {
            // 의미 있는 출력이 없으면 null 로 처리
            return null;
        }
        const deltaPlayers = publicPlayerUpdates.size > 0
            ? Array.from(publicPlayerUpdates.values())
            : undefined;
        const output = {
            appliedAcks: appliedAcks.length > 0 ? appliedAcks : undefined,
            invalidActions: invalidActions.length > 0 ? invalidActions : undefined,
            delta: deltaPlayers
                ? {
                    public: {
                        players: deltaPlayers,
                    },
                }
                : undefined,
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
        const instanceId = data?.cardInstanceId;
        const cardType = data?.cardType;
        const targetPlayerId = data?.targetPlayerId ?? null;
        if (!instanceId || !cardType) {
            ctx.invalidActions.push({
                actionId,
                playerId: actor.identity.playerId,
                code: "BAD_INPUT",
                message: "cardInstanceId and cardType are required",
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
        // v1: 칼/맥주만 처리하는 MVP, 폭탄/돋보기 등은 이후 확장
        if (card.type === "knife") {
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
            // 단순 데미지 1 적용
            target.hp = Math.max(0, target.hp - 1);
            if (target.hp === 0) {
                target.alive = false;
            }
            ctx.publicPlayerUpdates.set(target.identity.playerId, {
                playerId: target.identity.playerId,
                hp: target.hp,
                alive: target.alive,
            });
        }
        else if (card.type === "beer") {
            // 자기 자신 HP 1 회복 (최대 3)
            actor.hp = Math.min(3, actor.hp + 1);
            ctx.publicPlayerUpdates.set(actor.identity.playerId, {
                playerId: actor.identity.playerId,
                hp: actor.hp,
                alive: actor.alive,
            });
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
        // 사용한 카드는 손패에서 제거
        actor.hand.splice(handIndex, 1);
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
        const idSet = new Set(ids.filter((v) => typeof v === "string"));
        actor.hand = actor.hand.filter((c) => !idSet.has(c.id));
    }
    handleCardGive(actionId, actor, data, ctx) {
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
        // v1: 치료(healer_heal)와 무적방패(parry_shield)만 구현
        if (skillKey === "healer_heal") {
            if (!targetPlayerId) {
                ctx.invalidActions.push({
                    actionId,
                    playerId: actor.identity.playerId,
                    code: "INVALID_TARGET",
                    message: "targetPlayerId is required for healer_heal",
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
            target.hp = Math.min(3, target.hp + 1);
            ctx.publicPlayerUpdates.set(target.identity.playerId, {
                playerId: target.identity.playerId,
                hp: target.hp,
                alive: target.alive,
            });
            return;
        }
        ctx.invalidActions.push({
            actionId,
            playerId: actor.identity.playerId,
            code: "RULE_VIOLATION",
            message: `skill ${skillKey} not implemented`,
        });
    }
}
exports.StubGameEngine = StubGameEngine;
function createStubGameEngine() {
    return new StubGameEngine();
}
