// REST API DTO 타입 (클라이언트 관점)
// 문서: REST_API_Specification

export type ApiError = {
  code: string;
  message: string;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: ApiError;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// 2.1 POST /auth

export type AuthReconnectInfo = {
  available: boolean;
  roomId: string | null;
  gameId: string | null;
  roomTitle: string | null;
  phase: "lobby" | "game" | null;
  note: string | null;
};

export type AuthResponse = ApiResponse<{
  deviceId: string;
  reconnect: AuthReconnectInfo;
}>;

// 3.1 GET /rooms

export type RoomSummary = {
  roomId: string;
  roomTitle: string;
  isLocked: boolean;
  phase: "lobby" | "game";
  playerCount: number;
  maxPlayers: number;
};

export type GetRoomsResponse = ApiResponse<{
  rooms: RoomSummary[];
  nextCursor: string | null;
}>;

// 3.2 POST /rooms

export type CreateRoomResponse = ApiResponse<{
  room: {
    roomId: string;
    roomTitle: string;
    isLocked: boolean;
    phase: "lobby";
    maxPlayers: number;
  };
  session: {
    roomPlayerId: string;
    sessionToken: string;
    isHost: boolean;
  };
}>;

// 3.3 POST /rooms/{roomId}/join

export type JoinRoomResponse = ApiResponse<{
  room: {
    roomId: string;
    roomTitle: string;
    isLocked: boolean;
    phase: "lobby" | "game";
    maxPlayers: number;
  };
  session: {
    roomPlayerId: string;
    sessionToken: string;
    isHost: boolean;
  };
}>;

// 4.1 GET /rooms/{roomId}/poll

export type RoomPlayerSummary = {
  roomPlayerId: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  wins: number;
  losses: number;
  isInRoom: boolean;
};

export type RoomCountdown = {
  active: boolean;
  endsAtMs: number;
};

export type PollRoomResponse = ApiResponse<{
  room: {
    roomId: string;
    roomTitle: string;
    phase: "lobby" | "game";
    hostRoomPlayerId: string;
  };
  players: RoomPlayerSummary[];
  countdown: RoomCountdown | null;
  revision: number;
  unchanged: boolean;
}>;

// 4.2 POST /rooms/{roomId}/ready

export type ReadyRoomResponse = ApiResponse<{
  isReady: boolean;
}>;

// 4.3 /settings (GET/PATCH)

export type RoomSettings = {
  drawIntervalSec: number;
  bombDelaySec: number;
  handLimit: number;
  fearReviveHp: number;
  trollSurviveSec: number;
  teamCounts: { traitor: number; hero: number; civil: number };
  gmMode: {
    enabled: boolean;
    hostIsGM: boolean;
    fixedRoles: Record<string, string>;
  };
};

export type GetRoomSettingsResponse = ApiResponse<{
  settings: RoomSettings;
}>;

export type PatchRoomSettingsResponse = ApiResponse<{
  settings: RoomSettings;
}>;

// 4.5 POST /rooms/{roomId}/start

export type StartRoomResponse = ApiResponse<{
  started: boolean;
  countdown: {
    active: boolean;
    endsAtMs: number;
  };
  gameId: string;
}>;

// 5.1 DELETE /rooms/{roomId}

export type DeleteRoomResponse = ApiResponse<{
  deleted: boolean;
}>;

