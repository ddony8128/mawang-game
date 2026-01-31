// 게임 설정 타입
// 문서: document/ServerStateModel 3. GameSettings

import type { RoleKey, Team, Side } from "./identity";

export type GameSettings = {
  // 카드/드로우
  drawIntervalSec: 40 | 60 | 120 | 180 | 240; // 40초 / 1/2/3/4분
  bombDelaySec: 60 | 180 | 300 | 420; // 1/3/5/7분
  handLimit: 3 | 4 | 5;

  // 마왕
  fearReviveHp: 1 | 2 | 3;
  trollSurviveSec: 60 | 180 | 300;

  // 팀 구성(마왕은 항상 1)
  teamCounts: { traitor: number; hero: number; civil: number };

  // GM 모드
  gmMode: {
    enabled: boolean;
    hostIsGM: boolean;
    fixedRoles: Record<string, RoleKey>; // PlayerId -> RoleKey
  };
};

// 승리/종료 타입 (문서 8. GameEndState)
export type GameEndReason = "MAWANG_DEAD" | "ALL_HERO_DEAD" | "ABORTED";

export type GameEndPlayerResult = {
  playerId: string;
  nickname: string;
  win: boolean;
  alive: boolean;
  role: RoleKey;
  team: Team;
  side: Side;
};

export type GameEndState = {
  gameId: string;
  roomId: string;
  seq: number;
  endedAtMs: number;
  reason: GameEndReason;
  results: GameEndPlayerResult[];
};

