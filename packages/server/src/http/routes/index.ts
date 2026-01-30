import type express from "express";

import { authRouter } from "./auth";
import { healthRouter } from "./health";
import { roomsRouter } from "./rooms";

export function registerRoutes(app: express.Express) {
  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/rooms", roomsRouter);
}


