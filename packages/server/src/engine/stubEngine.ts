import type {
  EngineOutput,
  EngineTask,
  GameEngine,
} from "./types";

// 아직 실제 룰을 구현하지 않은 stub 엔진.
// WS 레이어/TimerRegistry 와의 결합을 테스트하는 용도로만 사용한다.
export class StubGameEngine implements GameEngine {
  private readonly queue: EngineTask[] = [];

  enqueue(task: EngineTask): void {
    this.queue.push(task);
  }

  processLoop(): EngineOutput | null {
    if (this.queue.length === 0) return null;

    // 현재는 아무 로직도 적용하지 않고 입력만 소비한다.
    this.queue.shift();
    return {};
  }
}

export function createStubGameEngine(): GameEngine {
  return new StubGameEngine();
}

