import type { GameSnapshot, PlayerState } from "../types/serverState";
import type { GameLogState, LogItem } from "../types/effects";

// 서버 전용 FoggedGameState 타입 (클라이언트와 구조를 맞추되, 의존성을 분리하기 위해 별도 정의)
export type FoggedKnownRole = {
  kind: "team" | "role";
  team?: "good" | "evil";
  role?: string;
  obtainedAtMs: number;
  by: "magnifier2" | "magnifier3" | "skill";
};

export type FoggedVisibleEffect =
  | { kind: "bomb"; id: string; explodeAtMs: number }
  | { kind: "feared"; id: string; untilMs: number }
  | { kind: "shield"; id: string; untilMs: number }
  | { kind: "trollStubborn"; id: string; untilMs: number }
  | { kind: "fakeHpTick"; id: string; tickAtMs: number }
  | { kind: "fearReviveUsed"; id: string }
  | { kind: "slayerUltUsed"; id: string };

export type FoggedLogItem = {
  id: string;
  seq: number;
  atMs: number;
  type: string;
  payload: Record<string, any>;
  modal: boolean;
  modalUi?: {
    title: string;
    message: string;
    imageUrl?: string;
  };
};

export type FoggedLogState = {
  lastSeq: number;
  items: FoggedLogItem[];
};

export type FoggedGameState = {
  schemaVersion: 1;
  ids: GameSnapshot["ids"];
  meta: {
    state: GameSnapshot["meta"]["state"];
    snapshotVersion: number;
    nowMs: number;
  };
  timers: {
    nextDrawAtMs: number;
  };
  me: {
    playerId: string;
    nickname: string;
    role: string;
    team: "good" | "evil";
    side: "hero" | "civil" | "evil" | "traitor";
    alive: boolean;
    hp: number;
    hand: PlayerState["hand"];
    effects: FoggedVisibleEffect[];
    cooldowns: PlayerState["cooldowns"];
    know: {
      byTarget: Record<string, FoggedKnownRole[]>;
    };
  };
  players: Array<{
    playerId: string;
    nickname: string;
    alive: boolean;
    hp: number;
  }>;
  log: FoggedLogState;
};

export function createFoggedState(
  snapshot: GameSnapshot,
  viewerId: string,
): FoggedGameState {
  const me = snapshot.players[viewerId];

  if (!me) {
    throw new Error(`viewer ${viewerId} not found in snapshot`);
  }

  const nowMs = snapshot.timers.nowMs;

  const players = snapshot.seating.map((pid) => {
    const p = snapshot.players[pid];
    // 약골의 HP 는 모두에게도 비정상적으로 보이도록 fakeHp 를 사용한다.
    const publicHp =
      p.role === "weakling" && typeof p.fake.fakeHp === "number"
        ? p.fake.fakeHp
        : p.hp;
    return {
      playerId: p.identity.playerId,
      nickname: p.identity.nickname,
      alive: p.alive,
      hp: publicHp,
    };
  });

  // 정신병자/약골/가면놀이 등 fake 표시 처리
  const isMadman = me.role === "madman";
  const displayRole = isMadman && me.fake.fakeRole ? me.fake.fakeRole : me.role;
  const displayTeam =
    isMadman && me.fake.fakeTeam ? me.fake.fakeTeam : me.team;
  const displaySide =
    isMadman && me.fake.fakeSide ? me.fake.fakeSide : me.side;

  // 약골: 본인에게는 fakeHp 가 있으면 그 값을 보여준다.
  const displayHp =
    me.role === "weakling" && typeof me.fake.fakeHp === "number"
      ? me.fake.fakeHp
      : me.hp;

  // 정신병자: fakeCooldowns 가 있으면 그것을 표시용으로 사용
  const displayCooldowns =
    isMadman && me.fake.fakeCooldowns ? me.fake.fakeCooldowns : me.cooldowns;

  const visibleEffects = toVisibleEffects(me, viewerId);
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
      role: displayRole,
      team: displayTeam,
      side: displaySide,
      alive: me.alive,
      hp: displayHp,
      hand: me.hand,
      effects: visibleEffects,
      cooldowns: displayCooldowns,
      know: {
        byTarget: me.knowledge.knownByTarget as Record<string, FoggedKnownRole[]>,
      },
    },
    players,
    log: foggedLog,
  };
}

function toVisibleEffects(
  player: PlayerState,
  viewerId: string,
): FoggedVisibleEffect[] {
  const effects: FoggedVisibleEffect[] = [];

  for (const e of player.effects) {
    // self_hidden 효과는 대상 본인에게도 보이지 않는다.
    if (e.visibility === "self_hidden" && player.identity.playerId === viewerId) {
      continue;
    }

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

function filterLogForViewer(log: GameLogState, viewerId: string): FoggedLogState {
  const items: FoggedLogItem[] = [];

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
    lastSeq: items.length > 0 ? items[items.length - 1]!.seq : log.lastSeq,
    items,
  };
}

function isVisibleToViewer(item: LogItem, viewerId: string): boolean {
  const audience = item.audience;
  if (audience.kind === "global") return true;
  if (audience.kind === "player") return audience.playerId === viewerId;
  if (audience.kind === "team") {
    // v1: 팀 기반 로그는 모두에게는 보이지 않고, 팀 여부를 알기 어렵기 때문에
    // 엔진에서 이미 해당 팀 플레이어 전원에게 personal 로그를 복제해주는 쪽이 더 안전하다.
    return false;
  }
  return false;
}

