// 엔진 I/O 및 TimerRegistry 인터페이스
// 문서: document/CoreGameLogicDesign 2.1~2.3, 6, 7

import type { CardInstance } from "../types/cards";
import type { GameEndState } from "../types/gameSettings";
import type { KnowRole as KnowState, LogItem } from "../types/effects";

export type EngineTask =
  | {
      kind: "PLAYER_ACTION";
      actionId: string;
      atMs: number;
      actorPlayerId: string;
      actionType: "ability" | "card_use" | "card_give" | "discard";
      // WebSocketEventSpecification 의 action payload 와 매핑
      data: any;
    }
  | {
      kind: "TIMER_FIRED";
      timerId: string;
      atMs: number;
      timerType: "CARD_DRAW" | "BOMB_EXPLODE" | "EFFECT_EXPIRE" | "WEAKLING_FAKE_HP_TICK";
      payload: any;
    }
  | {
      kind: "SYSTEM_TASK";
      atMs: number;
      type: "FORCE_DEAD_BY_TIMEOUT";
      playerId: string;
    }
  | {
      kind: "INTERNAL_TASK";
      atMs: number;
      type:
        | "PLAYER_DIED"
        | "PROCESS_DEATH_CHAIN"
        | "CHECK_END"
        | "APPLY_DAMAGE"
      | "APPLY_HEAL"
      | "ABORT_GAME";
      payload: any;
    };

// TIMER_FIRED 에서만 사용되는 타이머 타입 유니온
export type TimerType = Extract<
  EngineTask,
  { kind: "TIMER_FIRED" }
>["timerType"];

export type EngineDelta = {
  public: {
    players?: Array<{ playerId: string; hp: number; alive: boolean }>;
    nextDrawAtMs?: number;
  };
  privateByPlayer?: Record<
    string,
    {
      hand?: CardInstance[];
      know?: KnowState;
      stateChanged?: true;
      logItems?: LogItem[];
    }
  >;
};

export type EngineDbEvent =
  | { type: "SAVE_SNAPSHOT"; reason: "tick" | "end" }
  | { type: "RECORD_RESULTS"; gameId: string };

export type EngineOutput = {
  appliedAcks?: Array<{
    actionId: string;
    playerId: string;
  }>;
  invalidActions?: Array<{
    actionId: string;
    playerId: string;
    code: string;
    message: string;
  }>;
  delta?: EngineDelta;
  endState?: GameEndState;
  dbEvents?: EngineDbEvent[];
};

// 타이머 레지스트리 인터페이스
export interface TimerRegistry {
  nowMs(): number;

  scheduleAt(
    atMs: number,
    timerType: TimerType,
    payload: any,
  ): string;

  scheduleIn(
    delayMs: number,
    timerType: TimerType,
    payload: any,
  ): string;

  cancel(timerId: string): void;

  list(): Array<{ timerId: string; atMs: number; timerType: string; payload: any }>;
}

// 게임 엔진 인터페이스
export interface GameEngine {
  enqueue(task: EngineTask): void;
  /**
   * 큐에 있는 task 를 1개 이상 처리하고, WS 레이어로 전달할 누적 출력.
   * 처리할 task 가 없으면 null 을 리턴한다.
   */
  processLoop(): EngineOutput | null;
}

