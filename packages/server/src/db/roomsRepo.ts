import { supabase } from "./supabase";

export type RoomPhase = "lobby" | "countdown" | "game" | "closed";

export type RoomRecord = {
  id: string;
  title: string;
  is_locked: boolean;
  max_players: number;
  phase: RoomPhase;
  settings: Record<string, any>;
  host_player_id: string | null;
};

export type ListRoomsParams = {
  limit?: number;
  cursor?: string | null;
};

export async function listRooms(params: ListRoomsParams) {
  const limit = params.limit ?? 50;

  let query = supabase
    .from("rooms")
    .select(
      "id,title,is_locked,max_players,phase,updated_at,room_players!inner(id,nickname,is_host)",
    )
    // 삭제된 방(closed)이나 이미 진행 중인 방(game)은 목록에서 제외하고
    // 로비에 있는 방(lobby)만 노출한다.
    .eq("phase", "lobby")
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
  const rooms = (data ?? []).map((row: any) => ({
    roomId: row.id as string,
    roomTitle: row.title as string,
    isLocked: row.is_locked as boolean,
    phase: (row.phase as RoomPhase) === "game" ? "game" : "lobby",
    playerCount: Array.isArray(row.room_players) ? row.room_players.length : 0,
    hostNickname: Array.isArray(row.room_players)
      ? (row.room_players.find((p: any) => p.is_host)?.nickname as string | null) ??
        null
      : null,
    maxPlayers: row.max_players as number,
  }));

  // cursor 구현은 updated_at 기준 문자열로 단순 처리
  const nextCursor =
    data && data.length === limit ? (data[data.length - 1] as any).updated_at : null;

  return { rooms, nextCursor: nextCursor as string | null };
}

