"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTimerRegistry = createTimerRegistry;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Node.js 기반의 간단한 TimerRegistry 구현.
 * - setTimeout 으로 만료를 스케줄링하고,
 * - 만료 시 EngineTask(TIMER_FIRED)를 enqueue 콜백으로 전달한다.
 */
class NodeTimerRegistry {
    enqueue;
    timers = new Map();
    constructor(enqueue) {
        this.enqueue = enqueue;
    }
    nowMs() {
        return Date.now();
    }
    scheduleAt(atMs, timerType, payload) {
        const timerId = crypto_1.default.randomUUID();
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
    scheduleIn(delayMs, timerType, payload) {
        const atMs = Date.now() + delayMs;
        return this.scheduleAt(atMs, timerType, payload);
    }
    cancel(timerId) {
        const entry = this.timers.get(timerId);
        if (!entry)
            return;
        clearTimeout(entry.timeout);
        this.timers.delete(timerId);
    }
    list() {
        return Array.from(this.timers.values()).map((t) => ({
            timerId: t.timerId,
            atMs: t.atMs,
            timerType: t.timerType,
            payload: t.payload,
        }));
    }
}
function createTimerRegistry(enqueue) {
    return new NodeTimerRegistry(enqueue);
}
