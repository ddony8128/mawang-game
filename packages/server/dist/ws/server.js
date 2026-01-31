"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGameWsServer = createGameWsServer;
const ws_1 = require("ws");
const RoomRuntimeManager_1 = require("./RoomRuntimeManager");
// WS 서버를 초기화하고 HTTP 서버에 붙인다.
function createGameWsServer(server) {
    const wss = new ws_1.WebSocketServer({ server, path: "/ws" });
    const roomManager = new RoomRuntimeManager_1.RoomRuntimeManager();
    wss.on("connection", (socket, req) => {
        socket.on("message", (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                roomManager.handleRawMessage(socket, msg);
            }
            catch (err) {
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
