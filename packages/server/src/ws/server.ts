import type http from "http";

import { WebSocketServer, type RawData, type WebSocket } from "ws";

import { RoomRuntimeManager } from "./RoomRuntimeManager";

// WS 서버를 초기화하고 HTTP 서버에 붙인다.
export function createGameWsServer(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const roomManager = new RoomRuntimeManager();

  wss.on("connection", (socket: WebSocket, req) => {
    socket.on("message", (raw: RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        roomManager.handleRawMessage(socket, msg);
      } catch (err) {
        // 파싱 불가 시 단순 종료
        console.error("[WS] failed to parse incoming message, closing socket", err);
        socket.close();
      }
    });

    socket.on("close", (code, reason) => {
      roomManager.handleSocketClosed(socket);
    });

    socket.on("error", (err) => {
      console.error("[WS] socket error", err);
    });
  });

  wss.on("error", (err) => {
    console.error("[WS] WebSocketServer error", err);
  });
}

