"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRooms = listRooms;
const supabase_1 = require("./supabase");
async function listRooms(params) {
    const limit = params.limit ?? 50;
    let query = supabase_1.supabase
        .from("rooms")
        .select("id,title,is_locked,max_players,phase,updated_at,room_players!inner(id,nickname,is_host)")
        .in("phase", ["lobby", "game"])
        .order("updated_at", { ascending: false })
        .limit(limit);
    if (params.cursor) {
        query = query.lt("updated_at", params.cursor);
    }
    const { data, error } = await query;
    if (error) {
        // eslint-disable-next-line no-console
        console.error("[supabase][listRooms] error:", error);
        throw error;
    }
    // playerCount 는 room_players inner join count 를 활용
    const rooms = (data ?? []).map((row) => ({
        roomId: row.id,
        roomTitle: row.title,
        isLocked: row.is_locked,
        phase: row.phase === "game" ? "game" : "lobby",
        playerCount: Array.isArray(row.room_players) ? row.room_players.length : 0,
        hostNickname: Array.isArray(row.room_players)
            ? row.room_players.find((p) => p.is_host)?.nickname ??
                null
            : null,
        maxPlayers: row.max_players,
    }));
    // cursor 구현은 updated_at 기준 문자열로 단순 처리
    const nextCursor = data && data.length === limit ? data[data.length - 1].updated_at : null;
    return { rooms, nextCursor: nextCursor };
}
