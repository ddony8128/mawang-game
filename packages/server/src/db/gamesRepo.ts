import crypto from "crypto";

import { supabase } from "./supabase";

export type GameState = "running" | "ended" | "aborted";

export type GameRecord = {
  id: string;
  room_id: string;
  seq: number;
  state: GameState;
  settings: Record<string, any>;
  started_at: string;
  ended_at: string | null;
  snapshot: Record<string, any>;
  snapshot_version: number;
};

export async function createGameForRoom(params: {
  roomId: string;
  settings: Record<string, any>;
  seq: number;
}) {
  const gameId = crypto.randomUUID();
  // 간단한 RNG 시드: 안전성이 크게 중요하지 않으므로 Date 기반 + 랜덤값 사용
  const rngSeed = BigInt(Date.now()) ^ BigInt(crypto.randomInt(1, 1e9));

  const { data, error } = await supabase
    .from("games")
    .insert({
      id: gameId,
      room_id: params.roomId,
      seq: params.seq,
      state: "running",
      rng_seed: rngSeed.toString(), // BIGINT 로 저장
      settings: params.settings,
      snapshot: {},
      snapshot_version: 0,
    })
    .select("*")
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[supabase][createGameForRoom] error:", error);
    throw error;
  }
  return data as GameRecord;
}

