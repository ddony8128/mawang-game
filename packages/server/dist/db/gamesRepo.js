"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGameForRoom = createGameForRoom;
const supabase_1 = require("./supabase");
async function createGameForRoom(params) {
    const { data, error } = await supabase_1.supabase
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
    if (error)
        throw error;
    return data;
}
