import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RoomSession = {
  roomPlayerId: string;
  sessionToken: string;
  updatedAtMs: number;
};

export type ClientStore = {
  deviceId: string;
  sessions: Record<string, RoomSession>;
  setDeviceId: (deviceId: string) => void;
  setSession: (roomId: string, roomPlayerId: string, sessionToken: string) => void;
};

export const useClientStore = create<ClientStore>()(
  persist(
    (set, get) => ({
      deviceId: "",
      sessions: {},
      setDeviceId: (deviceId) => set({ deviceId }),
      setSession: (roomId, roomPlayerId, sessionToken) => {
        const now = Date.now();
        const prev = get().sessions;
        set({
          sessions: {
            ...prev,
            [roomId]: { roomPlayerId, sessionToken, updatedAtMs: now },
          },
        });
      },
    }),
    {
      name: "mawang_client",
    },
  ),
);

