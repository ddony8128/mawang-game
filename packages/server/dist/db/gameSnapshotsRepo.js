"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertGameSnapshot = insertGameSnapshot;
exports.saveSnapshot = saveSnapshot;
exports.loadLatestSnapshot = loadLatestSnapshot;
exports.recordGameEnd = recordGameEnd;
const crypto_1 = __importDefault(require("crypto"));
const supabase_1 = require("./supabase");
async function insertGameSnapshot(params) {
    const snapshotId = crypto_1.default.randomUUID();
    const { error } = await supabase_1.supabase.from("game_snapshots").insert({
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
async function saveSnapshot(params) {
    const { snapshot, gameId } = params;
    const snapshotVersion = snapshot.meta.snapshotVersion;
    await insertGameSnapshot({
        gameId,
        snapshotVersion,
        snapshot: snapshot,
    });
    const { error } = await supabase_1.supabase
        .from("games")
        .update({
        snapshot: snapshot,
        snapshot_version: snapshotVersion,
    })
        .eq("id", gameId);
    if (error) {
        // eslint-disable-next-line no-console
        console.error("[supabase][saveSnapshot] error:", error);
        throw error;
    }
}
async function loadLatestSnapshot(gameId) {
    const { data, error } = await supabase_1.supabase
        .from("games")
        .select("snapshot, snapshot_version")
        .eq("id", gameId)
        .single();
    if (error) {
        // eslint-disable-next-line no-console
        console.error("[supabase][loadLatestSnapshot] error:", error);
        return null;
    }
    if (!data || !data.snapshot)
        return null;
    const snapshot = data.snapshot;
    snapshot.meta.snapshotVersion = data.snapshot_version ?? snapshot.meta.snapshotVersion;
    return snapshot;
}
async function recordGameEnd(endState) {
    const { gameId, endedAtMs, reason, results } = endState;
    const endedAt = new Date(endedAtMs).toISOString();
    const { error: gameError } = await supabase_1.supabase
        .from("games")
        .update({
        state: "ended",
        ended_at: endedAt,
        end_reason: reason,
        end_state_json: endState,
    })
        .eq("id", gameId);
    if (gameError) {
        // eslint-disable-next-line no-console
        console.error("[supabase][recordGameEnd] update games error:", gameError);
    }
    for (const r of results) {
        const column = r.win ? "wins" : "losses";
        const { error: rpError } = await supabase_1.supabase.rpc("increment_room_player_stat", {
            p_room_player_id: r.playerId,
            p_column: column,
            p_delta: 1,
        });
        if (rpError) {
            // eslint-disable-next-line no-console
            console.error("[supabase][recordGameEnd] update room_players error:", rpError);
        }
    }
}
