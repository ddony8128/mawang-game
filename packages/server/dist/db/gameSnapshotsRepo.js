"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertGameSnapshot = insertGameSnapshot;
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
