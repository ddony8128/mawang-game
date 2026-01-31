import crypto from "crypto";

import { Router } from "express";

import { supabase } from "../../db/supabase";
import { sendOk } from "../apiResponse";

export const authRouter = Router();

authRouter.post("/", async (req, res) => {
  const headerDeviceId = req.header("x-device-id") ?? req.header("X-Device-Id");
  const bodyDeviceId =
    typeof req.body?.deviceId === "string" ? req.body.deviceId : null;

  const baseDeviceId = headerDeviceId || bodyDeviceId;
  const deviceId =
    baseDeviceId && baseDeviceId.length > 0
      ? baseDeviceId
      : crypto.randomUUID();

  // 최근 방/게임 재접속 가능 여부 조회
  let reconnect: {
    available: boolean;
    roomId: string | null;
    gameId: string | null;
    roomTitle: string | null;
    phase: "lobby" | "game" | null;
    note: string | null;
  } = {
    available: false,
    roomId: null,
    gameId: null,
    roomTitle: null,
    phase: null,
    note: null,
  };

  try {
    const { data: rpRows, error: rpError } = await supabase
      .from("room_players")
      .select("room_id, created_at, is_in_room")
      .eq("device_id", deviceId)
      .eq("is_in_room", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!rpError && rpRows && rpRows.length > 0) {
      const roomId = rpRows[0].room_id as string;
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("id,title,phase")
        .eq("id", roomId)
        .single();

      if (roomError) {
        // eslint-disable-next-line no-console
        console.error("[supabase][auth rooms] error:", roomError);
      } else if (room) {
        // 재접속은 "게임 중인 방" 에 대해서만 허용한다.
        if (room.phase === "game") {
          reconnect = {
            available: true,
            roomId: room.id as string,
            gameId: null,
            roomTitle: room.title as string,
            phase: "game",
            note: null,
          };
        } else {
          // lobby/closed 등은 재접속 대상에서 제외
          reconnect = {
            available: false,
            roomId: null,
            gameId: null,
            roomTitle: null,
            phase: null,
            note: null,
          };
        }
      }
    } else if (rpError) {
      // eslint-disable-next-line no-console
      console.error("[supabase][auth room_players] error:", rpError);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[authRouter] unexpected error:", err);
  }

  sendOk(res, {
    deviceId,
    reconnect,
  });
});

