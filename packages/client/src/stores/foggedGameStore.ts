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

          const template = buildModalTemplate(item);

          uiStore.pushModal({
            id: item.id,
            title: item.modalUi?.title ?? template.title,
            message: item.modalUi?.message ?? template.message,
            createdAtMs: item.atMs,
            imageUrl: item.modalUi?.imageUrl ?? template.imageUrl,
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

const ROLE_NAME_MAP: Record<string, string> = {
  mawang_fear: "공포의 마왕",
  mawang_troll: "분탕의 마왕",
  aide: "참모",
  fallen: "타락자",
  parryman: "패링맨",
  slayer: "슬레이어",
  sage: "현자",
  healer: "힐러",
  weakling: "약골",
  coward: "겁쟁이",
  madman: "정신병자",
  experiment_host: "실험체",
};

function buildModalTemplate(
  item: FoggedLogItem,
): { title: string; message: string; imageUrl?: string } {
  const t = item.type;
  const p = item.payload ?? {};

  switch (t) {
    case "GLOBAL_FEAR_REVIVE_TRIGGERED": {
      const state = useFoggedGameStore.getState().state;
      const revivedPlayerId =
        typeof p.playerId === "string" ? (p.playerId as string) : null;
      const revivedName =
        state?.players.find((pl) => pl.playerId === revivedPlayerId)
          ?.nickname ?? "마왕";
      return {
        title: "공포의 재림",
        message: `${revivedName}이(가) 마왕으로 부활했습니다. 정체가 드러나고 전투가 계속됩니다.`,
      };
    }
    case "GLOBAL_TROLL_STUBBORN_TRIGGERED":
      return {
        title: "분탕의 집념",
        message: "분탕의 마왕이 잠시 죽지 않는 집념 상태에 돌입했습니다.",
      };
    case "GLOBAL_SLAYER_ULT_USED":
      return {
        title: "슬레이어의 필살기",
        message: "슬레이어가 필살기를 사용했습니다. 누군가 큰 피해를 입었습니다.",
      };
    case "PERSONAL_DIED":
      return {
        title: "사망",
        message: "당신은 사망했습니다. 더 이상 행동할 수 없습니다.",
      };
    case "PERSONAL_HIT_BY_KNIFE":
      return {
        title: "칼에 맞았습니다",
        message: "누군가의 공격으로 피해를 입었습니다.",
      };
    case "PERSONAL_BOMB_PLANTED_ON_ME":
      return {
        title: "폭탄 설치됨",
        message: "당신에게 폭탄이 설치되었습니다. 시한이 끝나면 큰 피해를 입습니다.",
      };
    case "PERSONAL_BOMB_EXPLODED_ON_ME":
      return {
        title: "폭탄 폭발",
        message: "당신에게 설치된 폭탄이 폭발했습니다.",
      };
    case "PERSONAL_COWARD_CARD_FAILED":
      return {
        title: "손이 떨려요",
        message: "겁쟁이 특성 때문에 카드 사용에 실패했습니다.",
      };
    case "EVIL_TEAM_EXPERIMENT_HOST_DIED_BONUS":
      return {
        title: "저주의 숙주",
        message: "실험체가 사망하여 악 팀 전원이 카드 2장을 얻었습니다.",
      };
    case "PERSONAL_AIDE_HERO_LIST":
      {
        const heroRoles: string[] = Array.isArray(p.heroRolesInGame)
          ? (p.heroRolesInGame as string[])
          : [];
        const mawangNickname =
          typeof p.mawangNickname === "string" ? p.mawangNickname : "마왕";

        if (heroRoles.length > 0) {
          const heroNames = heroRoles
            .map((r) => ROLE_NAME_MAP[r] ?? r)
            .join(", ");
          return {
            title: "악의 하수인 정보",
            message: `마왕: ${mawangNickname}\n용사 역할: ${heroNames}`,
          };
        }

        return {
          title: "악의 하수인 정보",
          message: `마왕: ${mawangNickname}\n용사 구성 정보는 없습니다.`,
        };
      }
    case "PERSONAL_SKILL_USED":
      return {
        title: "능력 사용",
        message: "능력을 사용했습니다.",
      };
    case "PERSONAL_CARD_USED":
      return {
        title: "카드 사용",
        message: "카드를 사용했습니다.",
      };
    case "PERSONAL_CARD_GIVEN":
      return {
        title: "카드 양도",
        message: "다른 플레이어에게 카드를 건넸습니다.",
      };
    case "PERSONAL_CARD_RECEIVED":
      return {
        title: "카드 수신",
        message: "다른 플레이어로부터 카드를 받았습니다.",
      };
    default:
      return {
        title: "알림",
        message: "",
      };
  }
}

function mergePlayers(
  base: FoggedGameState["players"],
  patch: FoggedGameState["players"],
): FoggedGameState["players"] {
  const byId = new Map<string, FoggedGameState["players"][number]>();
  for (const player of base) {
    byId.set(player.playerId, { ...player });
  }
  for (const player of patch) {
    const prev = byId.get(player.playerId);
    if (prev) {
      byId.set(player.playerId, { ...prev, ...player });
    } else {
      byId.set(player.playerId, player);
    }
  }
  return Array.from(byId.values());
}

