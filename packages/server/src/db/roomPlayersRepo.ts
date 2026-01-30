import { supabase } from "./supabase";

export type RoomPlayerRecord = {
  id: string;
  room_id: string;
  nickname: string;
  is_host: boolean;
  is_ready: boolean;
  is_in_room: boolean;
  wins: number;
  losses: number;
  device_id: string | null;
};

export async function listRoomPlayers(roomId: string) {
  const { data, error } = await supabase
    .from("room_players")
    .select(
      "id,room_id,nickname,is_host,is_ready,is_in_room,wins,losses",
    )
    .eq("room_id", roomId)
    .eq("is_in_room", true)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as RoomPlayerRecord[];
}

export async function updateReadyState(
  roomPlayerId: string,
  ready: boolean,
) {
  const { data, error } = await supabase
    .from("room_players")
    .update({ is_ready: ready })
    .eq("id", roomPlayerId)
    .select("id,is_ready")
    .single();

  if (error) throw error;
  return data as { id: string; is_ready: boolean };
}

