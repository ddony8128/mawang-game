// 클라이언트가 받는 FoggedGameState / 로그 / 이펙트 타입
// 문서: FrontendStateManagementDesign 4) useFoggedGameStore

import type { CardInstance } from "./cards";
import type { RoleKey, Side, Team } from "./identity";

export type KnownRole =
  | {
      kind: "team";
      team: Team;
      obtainedAtMs: number;
      by: "magnifier2" | "skill";
    }
  | {
      kind: "role";
      role: RoleKey;
      obtainedAtMs: number;
      by: "magnifier3" | "skill";
    };

export type VisibleEffect =
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
  type: string; // 세부 LogType 은 서버와 동기화되지만, 클라에서는 string 으로 둔다.
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

  ids: {
    roomId: string;
    gameId: string;
    seq: number;
  };

  meta: {
    state: "running" | "ended" | "aborted";
    snapshotVersion: number;
    nowMs: number;
  };

  timers: {
    nextDrawAtMs: number;
  };

  // 서버 GameSettings 에서 클라이언트가 알아야 하는 요약 정보
  settings: {
    drawIntervalSec: number;
    bombDelaySec: number;
    handLimit: number;
    fearReviveHp: number;
    trollSurviveSec: number;
    teamCounts: {
      traitor: number;
      hero: number;
      civil: number;
    };
  };

  me: {
    playerId: string;
    nickname: string;
    role: RoleKey;
    team: Team;
    side: Side;
    alive: boolean;
    hp: number;
    hand: CardInstance[];
    effects: VisibleEffect[];
    cooldowns: Array<{
      skillKey: string;
      readyAtMs: number;
    }>;
    know: {
      byTarget: Record<string, KnownRole[]>;
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

