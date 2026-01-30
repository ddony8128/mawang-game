import crypto from "crypto";

import type { EngineTask, TimerRegistry, TimerType } from "./types";

type TimerEntry = {
  timerId: string;
  atMs: number;
  timerType: TimerType;
  payload: any;
  timeout: ReturnType<typeof setTimeout>;
};

/**
 * Node.js 기반의 간단한 TimerRegistry 구현.
 * - setTimeout 으로 만료를 스케줄링하고,
 * - 만료 시 EngineTask(TIMER_FIRED)를 enqueue 콜백으로 전달한다.
 */
class NodeTimerRegistry implements TimerRegistry {
  private readonly enqueue: (task: EngineTask) => void;
  private readonly timers = new Map<string, TimerEntry>();

  constructor(enqueue: (task: EngineTask) => void) {
    this.enqueue = enqueue;
  }

  nowMs(): number {
    return Date.now();
  }

  scheduleAt(atMs: number, timerType: TimerType, payload: any): string {
    const timerId = crypto.randomUUID();
    const delay = Math.max(0, atMs - Date.now());

    const timeout = setTimeout(() => {
      this.timers.delete(timerId);
      this.enqueue({
        kind: "TIMER_FIRED",
        timerId,
        atMs: Date.now(),
        timerType,
        payload,
      });
    }, delay);

    this.timers.set(timerId, { timerId, atMs, timerType, payload, timeout });
    return timerId;
  }

  scheduleIn(delayMs: number, timerType: TimerType, payload: any): string {
    const atMs = Date.now() + delayMs;
    return this.scheduleAt(atMs, timerType, payload);
  }

  cancel(timerId: string): void {
    const entry = this.timers.get(timerId);
    if (!entry) return;
    clearTimeout(entry.timeout);
    this.timers.delete(timerId);
  }

  list(): Array<{ timerId: string; atMs: number; timerType: string; payload: any }> {
    return Array.from(this.timers.values()).map((t) => ({
      timerId: t.timerId,
      atMs: t.atMs,
      timerType: t.timerType,
      payload: t.payload,
    }));
  }
}

export function createTimerRegistry(
  enqueue: (task: EngineTask) => void,
): TimerRegistry {
  return new NodeTimerRegistry(enqueue);
}

