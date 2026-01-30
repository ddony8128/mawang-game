import { create } from "zustand";

export type ModalItem = {
  id: string;
  title: string;
  message: string;
  createdAtMs: number;
  imageUrl?: string;
};

export type UIStore = {
  currentModal: ModalItem | null;
  queue: ModalItem[];
  pushModal: (m: ModalItem) => void;
  confirmModal: () => void;
  clearModals: () => void;
};

export const useUIStore = create<UIStore>((set, get) => ({
  currentModal: null,
  queue: [],
  pushModal: (m) => {
    const { currentModal, queue } = get();
    if (!currentModal) {
      set({ currentModal: m });
    } else {
      set({ queue: [...queue, m] });
    }
  },
  confirmModal: () => {
    const { queue } = get();
    if (queue.length === 0) {
      set({ currentModal: null });
      return;
    }
    const [next, ...rest] = queue;
    set({ currentModal: next, queue: rest });
  },
  clearModals: () => set({ currentModal: null, queue: [] }),
}));

