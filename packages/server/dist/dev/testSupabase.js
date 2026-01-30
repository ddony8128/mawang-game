"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("../db/supabase");
async function main() {
    // 환경 변수 확인
    console.log("[testSupabase] SUPABASE_URL =", process.env.SUPABASE_URL);
    // rooms 테이블에서 몇 개만 읽어보기
    const { data, error } = await supabase_1.supabase
        .from("rooms")
        .select("id, title, phase, max_players")
        .limit(5);
    if (error) {
        console.error("[testSupabase] error while querying rooms:", error);
    }
    else {
        console.log("[testSupabase] rooms sample:", data);
    }
    // room_players 테이블도 간단히 확인 (있으면)
    const { data: players, error: playersError } = await supabase_1.supabase
        .from("room_players")
        .select("id, room_id, nickname, is_host, is_in_room")
        .limit(5);
    if (playersError) {
        console.error("[testSupabase] error while querying room_players:", playersError);
    }
    else {
        console.log("[testSupabase] room_players sample:", players);
    }
}
main().catch((err) => {
    console.error("[testSupabase] unexpected error:", err);
    process.exit(1);
});
