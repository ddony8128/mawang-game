"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFoggedState = createFoggedState;
function createFoggedState(snapshot, viewerId) {
    const me = snapshot.players[viewerId];
    if (!me) {
        throw new Error(`viewer ${viewerId} not found in snapshot`);
    }
    const nowMs = snapshot.timers.nowMs;
    const players = snapshot.seating.map((pid) => {
        const p = snapshot.players[pid];
        return {
            playerId: p.identity.playerId,
            nickname: p.identity.nickname,
            alive: p.alive,
            hp: p.hp,
        };
    });
    const visibleEffects = toVisibleEffects(me);
    const foggedLog = filterLogForViewer(snapshot.log, viewerId);
    return {
        schemaVersion: 1,
        ids: snapshot.ids,
        meta: {
            state: snapshot.meta.state,
            snapshotVersion: snapshot.meta.snapshotVersion,
            nowMs,
        },
        timers: {
            nextDrawAtMs: snapshot.timers.nextDrawAtMs,
        },
        me: {
            playerId: me.identity.playerId,
            nickname: me.identity.nickname,
            role: me.role,
            team: me.team,
            side: me.side,
            alive: me.alive,
            hp: me.hp,
            hand: me.hand,
            effects: visibleEffects,
            cooldowns: me.cooldowns,
            know: {
                byTarget: me.knowledge.knownByTarget,
            },
        },
        players,
        log: foggedLog,
    };
}
function toVisibleEffects(player) {
    const effects = [];
    for (const e of player.effects) {
        switch (e.kind) {
            case "bomb":
                effects.push({
                    kind: "bomb",
                    id: e.id,
                    explodeAtMs: e.payload.explodeAtMs,
                });
                break;
            case "feared":
                effects.push({
                    kind: "feared",
                    id: e.id,
                    untilMs: e.payload.untilMs,
                });
                break;
            case "shield":
                effects.push({
                    kind: "shield",
                    id: e.id,
                    untilMs: e.payload.untilMs,
                });
                break;
            case "trollStubborn":
                effects.push({
                    kind: "trollStubborn",
                    id: e.id,
                    untilMs: e.payload.untilMs,
                });
                break;
            case "fakeHpTick":
                effects.push({
                    kind: "fakeHpTick",
                    id: e.id,
                    tickAtMs: e.payload.tickAtMs,
                });
                break;
            case "fearReviveUsed":
                effects.push({ kind: "fearReviveUsed", id: e.id });
                break;
            case "slayerUltUsed":
                effects.push({ kind: "slayerUltUsed", id: e.id });
                break;
            default:
                break;
        }
    }
    return effects;
}
function filterLogForViewer(log, viewerId) {
    const items = [];
    for (const item of log.items) {
        if (isVisibleToViewer(item, viewerId)) {
            items.push({
                id: item.id,
                seq: item.seq,
                atMs: item.atMs,
                type: item.type,
                payload: item.payload,
                modal: item.modal,
                // v1: modalUi 는 서버에서 직접 생성하지 않고 비워둔다.
            });
        }
    }
    return {
        lastSeq: items.length > 0 ? items[items.length - 1].seq : log.lastSeq,
        items,
    };
}
function isVisibleToViewer(item, viewerId) {
    const audience = item.audience;
    if (audience.kind === "global")
        return true;
    if (audience.kind === "player")
        return audience.playerId === viewerId;
    if (audience.kind === "team") {
        // v1: 팀 기반 로그는 모두에게는 보이지 않고, 팀 여부를 알기 어렵기 때문에
        // 엔진에서 이미 해당 팀 플레이어 전원에게 personal 로그를 복제해주는 쪽이 더 안전하다.
        return false;
    }
    return false;
}
