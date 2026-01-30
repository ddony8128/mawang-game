// WebSocket 메시지 타입 (클라이언트 관점)
// 문서: WebSocketEventSpecification

export type WsClientReadyPayload = {
  roomId: string;
  gameId: string | null;
  roomPlayerId: string;
  sessionToken: string;
  lastSnapshotVersion: number;
  lastLogSeq: number;
  clientVersion?: string;
};

export type WsClientPongPayload = {
  pingId: string;
  clientTs: number;
};

export type WsClientActionBase = {
  actionId: string;
  roomId: string;
  gameId: string;
  actorPlayerId: string;
};

export type WsClientAbilityData = {
  skillKey:
    | "mawang_fear"
    | "mawang_mask"
    | "traitor_beer"
    | "parry_shield"
    | "slayer_ult"
    | "healer_heal";
  targetPlayerId: string | null;
  clientNowMs: number;
};

export type WsClientCardUseData = {
  cardInstanceId: string;
  cardType: "magnifier" | "knife" | "bomb" | "beer";
  targetPlayerId: string | null;
  useMode: "magnifier2" | "magnifier3" | "normal";
  clientNowMs: number;
};

export type WsClientCardGiveData = {
  cardInstanceId: string;
  toPlayerId: string;
  clientNowMs: number;
};

export type WsClientDiscardData = {
  cardInstanceIds: string[];
  clientNowMs: number;
};

export type WsClientActionPayload =
  | (WsClientActionBase & { actionType: "ability"; data: WsClientAbilityData })
  | (WsClientActionBase & { actionType: "card_use"; data: WsClientCardUseData })
  | (WsClientActionBase & { actionType: "card_give"; data: WsClientCardGiveData })
  | (WsClientActionBase & { actionType: "discard"; data: WsClientDiscardData });

export type WsClientDisconnectPayload = {
  roomId: string;
  gameId: string | null;
  roomPlayerId: string;
  reason: "game_end" | "user_exit" | "navigation";
};

export type WsClientMessage =
  | { type: "ready"; payload: WsClientReadyPayload }
  | { type: "pong"; payload: WsClientPongPayload }
  | { type: "action"; payload: WsClientActionPayload }
  | { type: "disconnect"; payload: WsClientDisconnectPayload };

// 서버 → 클라

import type { FoggedGameState, FoggedLogItem } from "./foggedGame";

export type WsServerPingPayload = {
  pingId: string;
  serverTs: number;
};

export type WsServerSnapshotPayload = {
  state: FoggedGameState;
};

export type WsServerPatchPayload = {
  baseSnapshotVersion: number;
  nextSnapshotVersion: number;
  // FoggedGameState 의 부분 업데이트를 의미한다.
  // 현재는 meta/timers/me/players/log 중 일부만 내려오지만,
  // 타입 상으로는 전체 FoggedGameState 에 대한 Partial 로 정의해 둔다.
  patch: Partial<FoggedGameState>;
  logItems?: FoggedLogItem[];
};

export type WsServerAckPayload = {
  actionId: string;
  accepted?: boolean;
  applied?: boolean;
};

export type WsServerInvalidActionPayload = {
  actionId: string;
  code: string;
  message: string;
};

export type WsServerErrorPayload = {
  code: string;
  message: string;
  recoverable: boolean;
  next: "retry_ready" | "go_lobby" | "none";
};

export type WsServerEndPayload = {
  endState: any; // GameEndState 의 fogged 버전 (필요 시 상세 정의)
};

export type WsServerMessage =
  | { type: "ping"; payload: WsServerPingPayload }
  | { type: "snapshot"; payload: WsServerSnapshotPayload }
  | { type: "patch"; payload: WsServerPatchPayload }
  | { type: "ack"; payload: WsServerAckPayload }
  | { type: "invalid_action"; payload: WsServerInvalidActionPayload }
  | { type: "error"; payload: WsServerErrorPayload }
  | { type: "end"; payload: WsServerEndPayload };

