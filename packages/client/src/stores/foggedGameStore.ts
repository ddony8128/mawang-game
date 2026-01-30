import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  FoggedGameState,
  FoggedLogItem,
} from "../types/foggedGame";
import { useUIStore } from "./uiStore";

export type FoggedGameStore = {
  state: FoggedGameState | null;
  applySnapshot: (snap: FoggedGameState) => void;
  applyPatch: (args: {
    baseSnapshotVersion: number;
    nextSnapshotVersion: number;
    patch: Partial<FoggedGameState>;
    logItems?: FoggedLogItem[];
  }) => void;
  appendLogItems: (items: FoggedLogItem[]) => void;
  reset: () => void;
};

export const useFoggedGameStore = create<FoggedGameStore>()(
  persist(
    (set, get) => ({
      state: null,
      applySnapshot: (snap) => {
        set({ state: snap });
      },
      applyPatch: ({ baseSnapshotVersion, nextSnapshotVersion, patch, logItems }) => {
        const current = get().state;
        if (!current) return;
        if (current.meta.snapshotVersion !== baseSnapshotVersion) {
          // 버전이 맞지 않으면 클라는 ready 재전송을 해야 한다.
          // 여기서는 단순히 무시.
          return;
        }

        const next: FoggedGameState = {
          ...current,
          ...patch,
          meta: {
            ...current.meta,
            snapshotVersion: nextSnapshotVersion,
            ...(patch.meta ?? {}),
          },
          timers: {
            ...current.timers,
            ...(patch.timers ?? {}),
          },
          me: {
            ...current.me,
            ...(patch.me ?? {}),
          },
          players: patch.players
            ? mergePlayers(current.players, patch.players)
            : current.players,
        };

        set({ state: next });

        if (logItems && logItems.length > 0) {
          get().appendLogItems(logItems);
        }
      },
      appendLogItems: (items) => {
        const current = get().state;
        if (!current || items.length === 0) return;

        const existingIds = new Set(current.log.items.map((i) => i.id));
        const newItems = items.filter((i) => !existingIds.has(i.id));

        if (newItems.length === 0) return;

        const mergedItems = [...current.log.items, ...newItems].sort(
          (a, b) => a.seq - b.seq,
        );

        set({
          state: {
            ...current,
            log: {
              lastSeq: mergedItems[mergedItems.length - 1]?.seq ?? current.log.lastSeq,
              items: mergedItems,
            },
          },
        });

        // modal=true 인 항목은 UI 모달 큐에 적재
        const uiStore = useUIStore.getState();
        for (const item of newItems) {
          if (!item.modal) continue;
          uiStore.pushModal({
            id: item.id,
            title: item.modalUi?.title ?? "알림",
            message: item.modalUi?.message ?? "",
            createdAtMs: item.atMs,
            imageUrl: item.modalUi?.imageUrl,
          });
        }
      },
      reset: () => set({ state: null }),
    }),
    {
      name: "mawang_fogged_game",
    },
  ),
);

function mergePlayers(
  base: FoggedGameState["players"],
  patch: FoggedGameState["players"],
): FoggedGameState["players"] {
  const byId = new Map<string, FoggedGameState["players"][number]>();
  for (const p of base) {
    byId.set(p.playerId, { ...p });
  }
  for (const p of patch) {
    const prev = byId.get(p.playerId);
    if (prev) {
      byId.set(p.playerId, { ...prev, ...p });
    } else {
      byId.set(p.playerId, p);
    }
  }
  return Array.from(byId.values());
}

