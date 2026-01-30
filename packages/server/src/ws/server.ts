import type http from "http";

import { WebSocketServer, type RawData, type WebSocket } from "ws";

import { RoomRuntimeManager } from "./RoomRuntimeManager";

// WS 서버를 초기화하고 HTTP 서버에 붙인다.
export function createGameWsServer(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const roomManager = new RoomRuntimeManager();

  wss.on("connection", (socket: WebSocket) => {
    socket.on("message", (raw: RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        roomManager.handleRawMessage(socket, msg);
      } catch (err) {
        // 파싱 불가 시 단순 종료
        socket.close();
      }
    });

    socket.on("close", () => {
      roomManager.handleSocketClosed(socket);
    });
  });
}

