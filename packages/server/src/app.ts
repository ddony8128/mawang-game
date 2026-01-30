import express from "express";
import cors from "cors";

import { registerRoutes } from "./http/routes";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  registerRoutes(app);

  return app;
}

