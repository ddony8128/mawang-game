import { httpJson } from "./http";
import {
  type AuthResponse,
  type CreateRoomResponse,
  type DeleteRoomResponse,
  type GetRoomSettingsResponse,
  type GetRoomsResponse,
  type JoinRoomResponse,
  type PatchRoomSettingsResponse,
  type PollRoomResponse,
  type ReadyRoomResponse,
  type StartRoomResponse,
} from "@/types/rest";
import { useClientStore } from "@/stores/clientStore";

type ResponseData<R> = R extends { data: infer D } ? D : never;

export class ApiError extends Error {
  code: string;
  status: number;
  data?: unknown;

  constructor(code: string, message: string, status = 400, data?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

async function unwrap<T>(path: string, options: RequestInit = {}) {
  const body = (await httpJson<any>(path, options)) as { ok: boolean } | undefined;
  if (!body || typeof body !== "object") {
    throw new ApiError("INVALID_RESPONSE", "Invalid API response");
  }
  if ((body as any).ok === true) {
    return (body as any).data as T;
  }
  const err = (body as any).error;
  throw new ApiError(
    err?.code ?? "API_ERROR",
    err?.message ?? "API error",
    400,
    body,
  );
}

function buildHeaders(roomId?: string): Record<string, string> {
  const { deviceId, sessions } = useClientStore.getState();
  const headers: Record<string, string> = {};
  if (deviceId) {
    headers["X-Device-Id"] = deviceId;
  }
  if (roomId) {
    const session = sessions[roomId];
    if (session) {
      headers["Authorization"] = `Bearer ${session.sessionToken}`;
      headers["X-Room-Player-Id"] = session.roomPlayerId;
    }
  }
  return headers;
}

// 2.1 POST /auth
export async function apiAuth(): Promise<ResponseData<AuthResponse>> {
  const { deviceId } = useClientStore.getState();
  const headers: Record<string, string> = {};
  const body: { deviceId?: string } = {};
  if (deviceId) {
    headers["X-Device-Id"] = deviceId;
    body.deviceId = deviceId;
  }

  const data = await unwrap<ResponseData<AuthResponse>>("/api/auth", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  // 저장
  useClientStore.getState().setDeviceId(data.deviceId);
  return data;
}

// 3.1 GET /rooms
export async function apiGetRooms(): Promise<ResponseData<GetRoomsResponse>> {
  const headers = buildHeaders();
  return await unwrap<ResponseData<GetRoomsResponse>>("/api/rooms", {
    method: "GET",
    headers,
  });
}

// 3.2 POST /rooms
export async function apiCreateRoom(params: {
  nickname: string;
  roomTitle: string;
  password: string | null;
}): Promise<ResponseData<CreateRoomResponse>> {
  const headers = buildHeaders();
  const data = await unwrap<ResponseData<CreateRoomResponse>>("/api/rooms", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  useClientStore
    .getState()
    .setSession(data.room.roomId, data.session.roomPlayerId, data.session.sessionToken);
  return data;
}

// 3.3 POST /rooms/{roomId}/join
export async function apiJoinRoom(params: {
  roomId: string;
  nickname: string;
  password: string | null;
}): Promise<ResponseData<JoinRoomResponse>> {
  const headers = buildHeaders();
  const data = await unwrap<ResponseData<JoinRoomResponse>>(
    `/api/rooms/${params.roomId}/join`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ nickname: params.nickname, password: params.password }),
    },
  );
  useClientStore
    .getState()
    .setSession(data.room.roomId, data.session.roomPlayerId, data.session.sessionToken);
  return data;
}

// 4.1 GET /rooms/{roomId}/poll
export async function apiPollRoom(
  roomId: string,
): Promise<ResponseData<PollRoomResponse>> {
  const headers = buildHeaders(roomId);
  return await unwrap<ResponseData<PollRoomResponse>>(
    `/api/rooms/${roomId}/poll`,
    {
      method: "GET",
      headers,
    },
  );
}

// 4.2 POST /rooms/{roomId}/ready
export async function apiReadyRoom(
  roomId: string,
  ready: boolean,
): Promise<ResponseData<ReadyRoomResponse>> {
  const headers = buildHeaders(roomId);
  return await unwrap<ResponseData<ReadyRoomResponse>>(
    `/api/rooms/${roomId}/ready`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ ready }),
    },
  );
}

// 4.3 GET /rooms/{roomId}/settings
export async function apiGetRoomSettings(
  roomId: string,
): Promise<ResponseData<GetRoomSettingsResponse>> {
  const headers = buildHeaders(roomId);
  return await unwrap<ResponseData<GetRoomSettingsResponse>>(
    `/api/rooms/${roomId}/settings`,
    {
      method: "GET",
      headers,
    },
  );
}

// 4.4 PATCH /rooms/{roomId}/settings
export async function apiPatchRoomSettings(
  roomId: string,
  settings: unknown,
): Promise<ResponseData<PatchRoomSettingsResponse>> {
  const headers = buildHeaders(roomId);
  return await unwrap<ResponseData<PatchRoomSettingsResponse>>(
    `/api/rooms/${roomId}/settings`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ settings }),
    },
  );
}

// 4.5 POST /rooms/{roomId}/start
export async function apiStartRoom(
  roomId: string,
  countdownSec: number,
): Promise<ResponseData<StartRoomResponse>> {
  const headers = buildHeaders(roomId);
  return await unwrap<ResponseData<StartRoomResponse>>(
    `/api/rooms/${roomId}/start`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ countdownSec }),
    },
  );
}

// 5.1 DELETE /rooms/{roomId}
export async function apiDeleteRoom(
  roomId: string,
): Promise<ResponseData<DeleteRoomResponse>> {
  const headers = buildHeaders(roomId);
  return await unwrap<ResponseData<DeleteRoomResponse>>(
    `/api/rooms/${roomId}`,
    {
    method: "GET",
    headers,
    },
  );
}

