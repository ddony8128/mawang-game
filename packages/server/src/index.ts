import http from "http";

import "dotenv/config";

import { createApp } from "./app";
import { createGameWsServer } from "./ws/server";

const app = createApp();
const server = http.createServer(app);

createGameWsServer(server);

const port = Number(process.env.PORT ?? 4000);

server.listen(port, () => {
  console.log(`Server listening on ${port}`);
});

