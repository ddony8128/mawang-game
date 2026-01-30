import type {
  WsClientActionPayload,
  WsClientMessage,
  WsServerMessage,
} from "@/types/ws";
import { useClientStore } from "@/stores/clientStore";
import { useFoggedGameStore } from "@/stores/foggedGameStore";

type WsConnectionState = "idle" | "connecting" | "connected" | "closed";

type WsClientOptions = {
  roomId: string;
  gameId: string | null;
  clientVersion?: string;
  onError?: (payload: WsServerMessage & { type: "error" }) => void;
  onEnd?: (payload: Extract<WsServerMessage, { type: "end" }>["payload"]) => void;
};

class WsClientImpl {
  private socket: WebSocket | null = null;
  private state: WsConnectionState = "idle";
  private roomId: string | null = null;
  private gameId: string | null = null;
  private clientVersion?: string;
  private onError?: WsClientOptions["onError"];
  private onEnd?: WsClientOptions["onEnd"];

  connect(opts: WsClientOptions) {
    if (this.state === "connected" || this.state === "connecting") return;

    this.roomId = opts.roomId;
    this.gameId = opts.gameId;
    this.clientVersion = opts.clientVersion;
    this.onError = opts.onError;
    this.onEnd = opts.onEnd;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/ws`;

    this.state = "connecting";
    const socket = new WebSocket(wsUrl);
    this.socket = socket;

    socket.onopen = () => {
      this.state = "connected";
      this.sendReady();
    };

    socket.onmessage = (event) => {
      this.handleServerMessage(event.data);
    };

    socket.onclose = () => {
      this.state = "closed";
      this.socket = null;
    };

    socket.onerror = () => {
      // onclose 에서 정리
    };
  }

  disconnect(reason: "game_end" | "user_exit" | "navigation" = "navigation") {
    if (!this.socket || this.state !== "connected" || !this.roomId) {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
      this.state = "closed";
      return;
    }

    const { sessions } = useClientStore.getState();
    const session = sessions[this.roomId];

    const msg: WsClientMessage = {
      type: "disconnect",
      payload: {
        roomId: this.roomId,
        gameId: this.gameId,
        roomPlayerId: session?.roomPlayerId ?? "",
        reason,
      },
    };

    try {
      this.socket.send(JSON.stringify(msg));
    } catch {
      // ignore
    }

    this.socket.close();
    this.socket = null;
    this.state = "closed";
  }

  sendAction(payload: WsClientActionPayload) {
    if (!this.socket || this.state !== "connected") return;
    const msg: WsClientMessage = { type: "action", payload };
    try {
      this.socket.send(JSON.stringify(msg));
    } catch {
      // ignore
    }
  }

  private sendReady() {
    if (!this.socket || !this.roomId) return;

    const clientStore = useClientStore.getState();
    const foggedStore = useFoggedGameStore.getState();

    const session = clientStore.sessions[this.roomId];
    const lastSnapshotVersion = foggedStore.state?.meta.snapshotVersion ?? 0;
    const lastLogSeq = foggedStore.state?.log.lastSeq ?? 0;

    const msg: WsClientMessage = {
      type: "ready",
      payload: {
        roomId: this.roomId,
        gameId: this.gameId,
        roomPlayerId: session?.roomPlayerId ?? "",
        sessionToken: session?.sessionToken ?? "",
        lastSnapshotVersion,
        lastLogSeq,
        clientVersion: this.clientVersion,
      },
    };

    try {
      this.socket.send(JSON.stringify(msg));
    } catch {
      // ignore
    }
  }

  private handleServerMessage(raw: any) {
    let msg: WsServerMessage;
    try {
      msg = JSON.parse(String(raw)) as WsServerMessage;
    } catch {
      return;
    }

    const foggedStore = useFoggedGameStore.getState();

    switch (msg.type) {
      case "ping": {
        // 서버 ping 에 대한 pong 전송
        if (!this.socket) return;
        const payload = msg.payload;
        const pong: WsClientMessage = {
          type: "pong",
          payload: {
            pingId: payload.pingId,
            clientTs: Date.now(),
          },
        };
        try {
          this.socket.send(JSON.stringify(pong));
        } catch {
          // ignore
        }
        break;
      }
      case "snapshot": {
        foggedStore.applySnapshot(msg.payload.state);
        break;
      }
      case "patch": {
        foggedStore.applyPatch({
          baseSnapshotVersion: msg.payload.baseSnapshotVersion,
          nextSnapshotVersion: msg.payload.nextSnapshotVersion,
          patch: msg.payload.patch,
          logItems: msg.payload.logItems,
        });
        break;
      }
      case "ack": {
        // v1: 별도 처리 없이도 충분하지만,
        // 필요하면 향후 액션 버튼 비활성화 해제 등에 사용할 수 있다.
        break;
      }
      case "invalid_action": {
        // TODO: 필요 시 토스트/모달로 노출
        break;
      }
      case "error": {
        this.onError?.(msg as WsServerMessage & { type: "error" });
        break;
      }
      case "end": {
        this.onEnd?.(msg.payload);
        break;
      }
    }
  }
}

export const wsClient = new WsClientImpl();

