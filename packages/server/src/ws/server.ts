import type http from "http";

import { WebSocketServer, type RawData, type WebSocket } from "ws";

import { RoomRuntimeManager } from "./RoomRuntimeManager";

// WS 서버를 초기화하고 HTTP 서버에 붙인다.
export function createGameWsServer(server: http.Server) {
  // WS 서버가 어느 포트/경로에 바인딩되는지 초기화 시점에 로그로 남긴다.
  // Render/Vercel 환경에서 업그레이드 문제가 있을 때, 이 로그 유무로
  // 프로세스까지 요청이 도달했는지 여부를 빠르게 확인할 수 있다.
  console.log("[WS] Initializing WebSocketServer on path /ws");

  const wss = new WebSocketServer({ server, path: "/ws" });
  const roomManager = new RoomRuntimeManager();

  wss.on("connection", (socket: WebSocket, req) => {
    // 새 WebSocket 연결이 성사된 시점에 기본 정보 로그
    console.log("[WS] connection established", {
      url: req.url,
      headers: {
        host: req.headers.host,
        origin: req.headers.origin,
        "x-forwarded-for": req.headers["x-forwarded-for"],
        "x-forwarded-proto": req.headers["x-forwarded-proto"],
      },
    });

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
      console.log("[WS] connection closed", {
        code,
        reason: reason.toString(),
      });
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

