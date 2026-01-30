"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const auth_1 = require("./auth");
const health_1 = require("./health");
const rooms_1 = require("./rooms");
function registerRoutes(app) {
    app.use("/api/health", health_1.healthRouter);
    app.use("/api/auth", auth_1.authRouter);
    app.use("/api/rooms", rooms_1.roomsRouter);
}
