import { supabase } from "./supabase";

export async function insertGameSnapshot(params: {
  gameId: string;
  snapshotVersion: number;
  snapshot: Record<string, any>;
}) {
  const { error } = await supabase.from("game_snapshots").insert({
    game_id: params.gameId,
    snapshot_version: params.snapshotVersion,
    snapshot: params.snapshot,
  });

  if (error) throw error;
}

