import crypto from "crypto";

import { supabase } from "./supabase";

export async function insertGameSnapshot(params: {
  gameId: string;
  snapshotVersion: number;
  snapshot: Record<string, any>;
}) {
  const snapshotId = crypto.randomUUID();

  const { error } = await supabase.from("game_snapshots").insert({
    id: snapshotId,
    game_id: params.gameId,
    snapshot_version: params.snapshotVersion,
    snapshot: params.snapshot,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[supabase][insertGameSnapshot] error:", error);
    throw error;
  }
}

