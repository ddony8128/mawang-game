"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGameWsServer = createGameWsServer;
const ws_1 = require("ws");
const RoomRuntimeManager_1 = require("./RoomRuntimeManager");
// WS 서버를 초기화하고 HTTP 서버에 붙인다.
function createGameWsServer(server) {
    const wss = new ws_1.WebSocketServer({ server, path: "/ws" });
    const roomManager = new RoomRuntimeManager_1.RoomRuntimeManager();
    wss.on("connection", (socket) => {
        socket.on("message", (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                roomManager.handleRawMessage(socket, msg);
            }
            catch (err) {
                // 파싱 불가 시 단순 종료
                socket.close();
            }
        });
        socket.on("close", () => {
            roomManager.handleSocketClosed(socket);
        });
    });
}
