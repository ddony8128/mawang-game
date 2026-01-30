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
  const { data, error } = await supabase
    .from("games")
    .insert({
      room_id: params.roomId,
      seq: params.seq,
      state: "running",
      settings: params.settings,
      snapshot: {},
      snapshot_version: 0,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as GameRecord;
}

