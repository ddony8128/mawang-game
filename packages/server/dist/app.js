"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = require("./http/routes");
function createApp() {
    const app = (0, express_1.default)();
    // CORS 설정
    // - 로컬 개발: localhost:5173 / localhost:4173 허용
    // - 프로덕션: https://mawang.perfect.ai.kr 허용
    // - credentials 포함 요청을 허용하기 위해 origin 을 와일드카드(*) 대신 구체적으로 지정
    const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:4173",
        "https://mawang.perfect.ai.kr",
    ];
    app.use((0, cors_1.default)({
        origin(origin, callback) {
            // 서버 간 통신 등 Origin 헤더가 없는 경우는 허용
            if (!origin) {
                return callback(null, true);
            }
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
    }));
    app.use(express_1.default.json());
    (0, routes_1.registerRoutes)(app);
    return app;
}
