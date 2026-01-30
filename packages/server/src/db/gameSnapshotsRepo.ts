import crypto from "crypto";

import { supabase } from "./supabase";
import type { GameSnapshot } from "../types/serverState";
import type { GameEndState } from "../types/gameSettings";

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

export async function saveSnapshot(params: {
  gameId: string;
  snapshot: GameSnapshot;
}) {
  const { snapshot, gameId } = params;
  const snapshotVersion = snapshot.meta.snapshotVersion;

  await insertGameSnapshot({
    gameId,
    snapshotVersion,
    snapshot: snapshot as unknown as Record<string, any>,
  });

  const { error } = await supabase
    .from("games")
    .update({
      snapshot: snapshot as unknown as Record<string, any>,
      snapshot_version: snapshotVersion,
    })
    .eq("id", gameId);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[supabase][saveSnapshot] error:", error);
    throw error;
  }
}

export async function loadLatestSnapshot(
  gameId: string,
): Promise<GameSnapshot | null> {
  const { data, error } = await supabase
    .from("games")
    .select("snapshot, snapshot_version")
    .eq("id", gameId)
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[supabase][loadLatestSnapshot] error:", error);
    return null;
  }

  if (!data || !data.snapshot) return null;

  const snapshot = data.snapshot as GameSnapshot;
  snapshot.meta.snapshotVersion = data.snapshot_version ?? snapshot.meta.snapshotVersion;
  return snapshot;
}

export async function recordGameEnd(endState: GameEndState) {
  const { gameId, endedAtMs, reason, results } = endState;

  const endedAt = new Date(endedAtMs).toISOString();

  const { error: gameError } = await supabase
    .from("games")
    .update({
      state: "ended",
      ended_at: endedAt,
      end_reason: reason,
      end_state_json: endState as unknown as Record<string, any>,
    })
    .eq("id", gameId);

  if (gameError) {
    // eslint-disable-next-line no-console
    console.error("[supabase][recordGameEnd] update games error:", gameError);
  }

  for (const r of results) {
    const column = r.win ? "wins" : "losses";
    const { error: rpError } = await supabase.rpc("increment_room_player_stat", {
      p_room_player_id: r.playerId,
      p_column: column,
      p_delta: 1,
    });

    if (rpError) {
      // eslint-disable-next-line no-console
      console.error(
        "[supabase][recordGameEnd] update room_players error:",
        rpError,
      );
    }
  }
}

