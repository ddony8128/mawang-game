"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
require("dotenv/config");
const app_1 = require("./app");
const server_1 = require("./ws/server");
const app = (0, app_1.createApp)();
const server = http_1.default.createServer(app);
(0, server_1.createGameWsServer)(server);
const port = Number(process.env.PORT ?? 4000);
server.listen(port, () => {
    console.log(`Server listening on ${port}`);
});
