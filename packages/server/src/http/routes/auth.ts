import { Router } from "express";

import { sendOk } from "../apiResponse";

export const authRouter = Router();

authRouter.post("/", (req, res) => {
  const headerDeviceId = req.header("x-device-id") ?? req.header("X-Device-Id");
  const bodyDeviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId : null;

  const baseDeviceId = headerDeviceId || bodyDeviceId;
  const deviceId = baseDeviceId && baseDeviceId.length > 0
    ? baseDeviceId
    : crypto.randomUUID();

  // v1: 재접속 정보는 아직 구현하지 않고, 항상 available=false 로 응답
  sendOk(res, {
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

