import { create } from "zustand";

import type { GameEndState } from "@/types/ws";

export type GameResultStore = {
  // roomId -> GameEndState
  endStates: Record<string, GameEndState>;
  setEndState: (state: GameEndState) => void;
  clearEndState: (roomId: string) => void;
};

export const useGameResultStore = create<GameResultStore>((set) => ({
  endStates: {},
  setEndState: (state) =>
    set((prev) => ({
      endStates: {
        ...prev.endStates,
        [state.roomId]: state,
      },
    })),
  clearEndState: (roomId) =>
    set((prev) => {
      const next = { ...prev.endStates };
      delete next[roomId];
      return { endStates: next };
    }),
}));

