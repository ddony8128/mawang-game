"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const apiResponse_1 = require("../apiResponse");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/", (req, res) => {
    const headerDeviceId = req.header("x-device-id") ?? req.header("X-Device-Id");
    const bodyDeviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId : null;
    const baseDeviceId = headerDeviceId || bodyDeviceId;
    const deviceId = baseDeviceId && baseDeviceId.length > 0
        ? baseDeviceId
        : crypto.randomUUID();
    // v1: 재접속 정보는 아직 구현하지 않고, 항상 available=false 로 응답
    (0, apiResponse_1.sendOk)(res, {
        deviceId,
        reconnect: {
            available: false,
            roomId: null,
            gameId: null,
            roomTitle: null,
            phase: null,
            note: null,
        },
    });
});
