"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StubGameEngine = void 0;
exports.createStubGameEngine = createStubGameEngine;
// 아직 실제 룰을 구현하지 않은 stub 엔진.
// WS 레이어/TimerRegistry 와의 결합을 테스트하는 용도로만 사용한다.
class StubGameEngine {
    queue = [];
    enqueue(task) {
        this.queue.push(task);
    }
    processLoop() {
        if (this.queue.length === 0)
            return null;
        // 현재는 아무 로직도 적용하지 않고 입력만 소비한다.
        this.queue.shift();
        return {};
    }
}
exports.StubGameEngine = StubGameEngine;
function createStubGameEngine() {
    return new StubGameEngine();
}
