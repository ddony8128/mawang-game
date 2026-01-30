"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRoomPlayers = listRoomPlayers;
exports.updateReadyState = updateReadyState;
const supabase_1 = require("./supabase");
async function listRoomPlayers(roomId) {
    const { data, error } = await supabase_1.supabase
        .from("room_players")
        .select("id,room_id,nickname,is_host,is_ready,is_in_room,wins,losses")
        .eq("room_id", roomId)
        .eq("is_in_room", true)
        .order("created_at", { ascending: true });
    if (error)
        throw error;
    return (data ?? []);
}
async function updateReadyState(roomPlayerId, ready) {
    const { data, error } = await supabase_1.supabase
        .from("room_players")
        .update({ is_ready: ready })
        .eq("id", roomPlayerId)
        .select("id,is_ready")
        .single();
    if (error)
        throw error;
    return data;
}
