import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MemoEntry = {
  text: string;
  updatedAtMs: number;
};

export type MemoStore = {
  byGame: Record<string, MemoEntry>;
  setMemo: (gameId: string, text: string) => void;
  clearMemo: (gameId: string) => void;
};

export const useMemoStore = create<MemoStore>()(
  persist(
    (set, get) => ({
      byGame: {},
      setMemo: (gameId, text) => {
        const now = Date.now();
        const prev = get().byGame;
        set({
          byGame: {
            ...prev,
            [gameId]: { text, updatedAtMs: now },
          },
        });
      },
      clearMemo: (gameId) => {
        const next = { ...get().byGame };
        delete next[gameId];
        set({ byGame: next });
      },
    }),
    {
      name: "mawang_memo",
    },
  ),
);

