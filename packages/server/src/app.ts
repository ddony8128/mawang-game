import express from "express";
import cors from "cors";

import { registerRoutes } from "./http/routes";

export function createApp() {
  const app = express();

  // CORS 설정
  // - 로컬 개발: localhost:5173 / localhost:4173 허용
  // - 프로덕션: https://mawang.perfect.ai.kr 허용
  // - credentials 포함 요청을 허용하기 위해 origin 을 와일드카드(*) 대신 구체적으로 지정
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://mawang.perfect.ai.kr",
  ];

  app.use(
    cors({
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
    }),
  );
  app.use(express.json());

  registerRoutes(app);

  return app;
}

