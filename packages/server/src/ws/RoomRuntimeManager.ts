import type { WebSocket } from "ws";

import type { GameEngine } from "../engine/types";
import { createStubGameEngine } from "../engine/stubEngine";

// 간단한 연결 상태
export type ConnectionState = {
  socket: WebSocket;
  roomId: string;
  roomPlayerId: string;
  missCount: number;
  lastPongAtMs: number;
};

// roomId 기준 런타임 관리 (v1: 매우 단순한 구조)
export class RoomRuntime {
  readonly roomId: string;
  private readonly engine: GameEngine;
  private readonly connections = new Map<string, ConnectionState>();

  constructor(roomId: string, engine?: GameEngine) {
    this.roomId = roomId;
    this.engine = engine ?? createStubGameEngine();
  }

  attachConnection(state: ConnectionState) {
    this.connections.set(state.roomPlayerId, state);
  }

  detachSocket(socket: WebSocket) {
    for (const [playerId, state] of this.connections) {
      if (state.socket === socket) {
        this.connections.delete(playerId);
        break;
      }
    }
  }

  // TODO: ready/action/pong 처리 및 엔진 연동은 이후 단계에서 구현
}

export class RoomRuntimeManager {
  private readonly rooms = new Map<string, RoomRuntime>();

  private getOrCreateRoom(roomId: string): RoomRuntime {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new RoomRuntime(roomId);
      this.rooms.set(roomId, room);
    }
    return room;
  }

  handleRawMessage(socket: WebSocket, msg: any) {
    if (!msg || typeof msg !== "object") return;

    const { type, payload } = msg;

    if (type === "ready" && payload && typeof payload.roomId === "string") {
      const roomId: string = payload.roomId;
      const roomPlayerId: string = payload.roomPlayerId;

      const room = this.getOrCreateRoom(roomId);
      room.attachConnection({
        socket,
        roomId,
        roomPlayerId,
        missCount: 0,
        lastPongAtMs: Date.now(),
      });

      // 엔진 상태를 fogging 해서 내려주는 부분은 이후 구현
      return;
    }

    if (type === "pong" && payload && typeof payload.pingId === "string") {
      // TODO: ping/pong 기반 missCount 갱신은 이후 구현
      return;
    }

    if (type === "action") {
      // TODO: EngineTask 로 변환하여 엔진에 enqueue
      return;
    }

    if (type === "disconnect") {
      socket.close();
      return;
    }
  }

  handleSocketClosed(socket: WebSocket) {
    for (const room of this.rooms.values()) {
      room.detachSocket(socket);
    }
  }
}

