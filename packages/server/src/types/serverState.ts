// 서버의 진짜 게임 상태 스냅샷 타입
// 문서: document/ServerStateModel 2. GameSnapshot, 4. PlayerState 등

import type { CardInstance } from "./cards";
import type { CooldownItem, Effect, GameLogState, KnowRole } from "./effects";
import type { GameEndState, GameSettings } from "./gameSettings";
import type { RoleKey, Side, Team } from "./identity";

export type PlayerIdentity = {
  playerId: string; // room_players.id
  nickname: string;
};

export type PlayerKnowledge = {
  knownByTarget: Record<string, KnowRole[]>; // targetPlayerId -> KnowRole[]
};

export type PlayerFake = {
  fakeRole?: RoleKey;
  fakeTeam?: Team;
  fakeSide?: Side;
  fakeHp?: number;
  fakeEffects?: Effect[];
  fakeCooldowns?: CooldownItem[];
};

export type PlayerState = {
  identity: PlayerIdentity;
  alive: boolean;

  // 공개 정보
  hp: number;

  // 서버 진실 역할/진영
  role: RoleKey;
  team: Team;
  side: Side;

  // 손패 (본인 외 비공개)
  hand: CardInstance[];

  // 상태/버프/디버프 (원본)
  effects: Effect[];

  // 쿨다운 원본
  cooldowns: CooldownItem[];

  // 내가 알아낸 규칙(타겟별)
  knowledge: PlayerKnowledge;

  // 가짜 표시 정보
  fake: PlayerFake;
};

export type GameSnapshotIds = {
  roomId: string;
  gameId: string;
  seq: number;
};

export type GameSnapshotMeta = {
  state: "running" | "ended" | "aborted";
  createdAtMs: number;
  startedAtMs: number;
  endedAtMs?: number;
  snapshotVersion: number;
};

export type GameRngState = {
  seed: string;
  counter: number;
};

export type GameTimersState = {
  nowMs: number;
  nextDrawAtMs: number;
};

export type GameSnapshot = {
  schemaVersion: 1;
  ids: GameSnapshotIds;
  meta: GameSnapshotMeta;
  settings: GameSettings;
  rng: GameRngState;
  timers: GameTimersState;
  seating: string[]; // PlayerId[]
  players: Record<string, PlayerState>;
  log: GameLogState;
  // 종료 상태는 엔진이 별도로 생성해 WS end 패킷으로 내려준다.
  endState?: GameEndState;
};

