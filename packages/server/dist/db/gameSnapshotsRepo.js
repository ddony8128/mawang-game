"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertGameSnapshot = insertGameSnapshot;
const supabase_1 = require("./supabase");
async function insertGameSnapshot(params) {
    const { error } = await supabase_1.supabase.from("game_snapshots").insert({
        game_id: params.gameId,
        snapshot_version: params.snapshotVersion,
        snapshot: params.snapshot,
    });
    if (error)
        throw error;
}
