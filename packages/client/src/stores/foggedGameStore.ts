import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  FoggedGameState,
  FoggedLogItem,
} from "../types/foggedGame";
import { useUIStore } from "./uiStore";

// ability images (실제 파일명 기준)
import imgFearRevive from "@/assets/ability/공포의_재림.jpg";
import imgTrollStubborn from "@/assets/ability/분탕의_집념.jpg";
import imgSlayerUlt from "@/assets/ability/짱쎈_필살기.jpg";
import imgCoward from "@/assets/ability/손떨림.png";
import imgExperimentCurse from "@/assets/ability/저주의_숙주.jpg";
import imgMawangMask from "@/assets/ability/가면놀이.png";
import imgMawangFear from "@/assets/ability/겁주기.png";
import imgTraitorBeer from "@/assets/ability/술자리_권유.jpg";
import imgParryShield from "@/assets/ability/무적방패.png";
import imgHealerHeal from "@/assets/ability/회복_마법.jpg";
import imgFeared from "@/assets/ability/겁주기_당함.png";

// card images
import imgCardMagnifier from "@/assets/card/돋보기.png";
import imgCardBeer from "@/assets/card/맥주.jpg";
import imgCardKnife from "@/assets/card/칼.png";
import imgCardKnifeHit from "@/assets/card/칼을_맞음.png";
import imgCardBomb from "@/assets/card/폭탄.png";
import imgCardBombPlanted from "@/assets/card/폭탄_설치_당함.jpg";
import imgCardBombExploded from "@/assets/card/폭탄이_터짐.jpg";
import imgCardTransfer from "@/assets/card/양도.jpg";

// result / role images
import imgDeath from "@/assets/result/사망.png";
import imgRoleAideInfo from "@/assets/role/참모.png";

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
        // 초기 스냅샷 수신 시에도, 모든 로그 아이템에 대해
        // 사람이 읽을 수 있는 modalUi 텍스트를 미리 채워 둔다.
        const logItemsWithUi =
          snap.log.items.map((item) => {
            if (item.modalUi && item.modalUi.message) {
              return item;
            }
            const template = buildModalTemplate(item);
            return {
              ...item,
              modalUi: {
                title: template.title,
                message: template.message,
                imageUrl: template.imageUrl,
              },
            };
          }) ?? [];

        set({
          state: {
            ...snap,
            log: {
              lastSeq: snap.log.lastSeq,
              items: logItemsWithUi,
            },
          },
        });
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
          settings: {
            ...current.settings,
            ...(patch as any).settings,
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
        const rawNewItems = items.filter((i) => !existingIds.has(i.id));

        if (rawNewItems.length === 0) return;

        // 모든 신규 로그에 대해, 사람이 읽을 수 있는 modalUi 텍스트를 채워 넣는다.
        // (모달로 띄우지 않는 로그라도, 규칙/로그 탭에서 자연어 문장을 재사용하기 위함)
        const newItems = rawNewItems.map((item) => {
          if (item.modalUi && item.modalUi.message) {
            return item;
          }

          const template = buildModalTemplate(item);
          return {
            ...item,
            modalUi: {
              title: template.title,
              message: template.message,
              imageUrl: template.imageUrl,
            },
          };
        });

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

        // modal=true 이거나, 특정 중요 이벤트(예: 맥주 사용)는 UI 모달 큐에 적재한다.
        const uiStore = useUIStore.getState();
        for (const item of newItems) {
          const isBeerUse =
            item.type === "PERSONAL_CARD_USED" &&
            (item.payload as any)?.cardType === "beer";

          const shouldShowModal = item.modal || isBeerUse;
          if (!shouldShowModal) continue;

          const template =
            item.modalUi ??
            buildModalTemplate(item);

          uiStore.pushModal({
            id: item.id,
            title: template.title,
            message: template.message,
            createdAtMs: item.atMs,
            imageUrl: template.imageUrl,
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
        imageUrl: imgFearRevive,
      };
    }
    case "GLOBAL_TROLL_STUBBORN_TRIGGERED":
      return {
        title: "분탕의 집념",
        message: "분탕의 마왕이 잠시 죽지 않는 집념 상태에 돌입했습니다.",
        imageUrl: imgTrollStubborn,
      };
    case "GLOBAL_SLAYER_ULT_USED": {
      const state = useFoggedGameStore.getState().state;
      const byPlayerId =
        typeof p.byPlayerId === "string" ? (p.byPlayerId as string) : null;
      const targetPlayerId =
        typeof p.targetPlayerId === "string" ? (p.targetPlayerId as string) : null;

      const byName =
        (state &&
          byPlayerId &&
          state.players.find((pl) => pl.playerId === byPlayerId)?.nickname) ||
        "슬레이어";
      const targetName =
        (state &&
          targetPlayerId &&
          state.players.find((pl) => pl.playerId === targetPlayerId)?.nickname) ||
        "알 수 없는 대상";

      return {
        title: "슬레이어의 필살기",
        message: `${byName}이(가) ${targetName}에게 필살기를 사용했습니다.`,
        imageUrl: imgSlayerUlt,
      };
    }
    case "PERSONAL_DIED":
      return {
        title: "사망",
        message: "당신은 사망했습니다. 더 이상 행동할 수 없습니다.",
        imageUrl: imgDeath,
      };
    case "PERSONAL_HIT_BY_KNIFE":
      return {
        title: "칼에 맞았습니다",
        message: "누군가의 공격으로 피해를 입었습니다.",
        imageUrl: imgCardKnifeHit,
      };
    case "PERSONAL_BOMB_PLANTED_ON_ME":
      return {
        title: "폭탄 설치됨",
        message: "당신에게 폭탄이 설치되었습니다. 시한이 끝나면 큰 피해를 입습니다.",
        imageUrl: imgCardBombPlanted,
      };
    case "PERSONAL_BOMB_EXPLODED_ON_ME":
      return {
        title: "폭탄 폭발",
        message: "당신에게 설치된 폭탄이 폭발했습니다.",
        imageUrl: imgCardBombExploded,
      };
    case "PERSONAL_COWARD_CARD_FAILED":
      return {
        title: "손이 떨려요",
        message: "겁쟁이 특성 때문에 카드 사용에 실패했습니다.",
        imageUrl: imgCoward,
      };
    case "EVIL_TEAM_EXPERIMENT_HOST_DIED_BONUS":
      return {
        title: "저주의 숙주",
        message: "실험체가 사망하여 악 팀 전원이 카드 2장을 얻었습니다.",
        imageUrl: imgExperimentCurse,
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
            imageUrl: imgRoleAideInfo,
          };
        }

        return {
          title: "악의 하수인 정보",
          message: `마왕: ${mawangNickname}\n용사 구성 정보는 없습니다.`,
          imageUrl: imgRoleAideInfo,
        };
      }
    case "PERSONAL_SKILL_USED": {
      const skillKey = typeof p.skillKey === "string" ? (p.skillKey as string) : "";
      switch (skillKey) {
        case "mawang_mask": {
          const fakeRoleKey =
            typeof p.fakeRole === "string" ? (p.fakeRole as string) : null;
          const fakeRoleName =
            (fakeRoleKey && ROLE_NAME_MAP[fakeRoleKey]) || fakeRoleKey || "알 수 없는 역할";
          return {
            title: "가면놀이",
            message: `이번 게임 동안 돋보기에 보일 자신의 역할을 “${fakeRoleName}”(으)로 위장했습니다.`,
            imageUrl: imgMawangMask,
          };
        }
        case "mawang_fear":
          return {
            title: "겁주기",
            message: "대상 1명을 2분간 행동 불가 상태로 만들었습니다.",
            imageUrl: imgMawangFear,
          };
        case "traitor_beer":
          return {
            title: "술자리 권유",
            message: "대상 1명의 다음 카드 뽑기에서 확정적으로 맥주를 뽑게 했습니다.",
            imageUrl: imgTraitorBeer,
          };
        case "parry_shield":
          return {
            title: "무적방패",
            message: "지금부터 1분간 피해를 받지 않습니다.",
            imageUrl: imgParryShield,
          };
        case "slayer_ult":
          return {
            title: "짱쎈 필살기",
            message: "대상 1명에게 강력한 필살기를 사용했습니다.",
            imageUrl: imgSlayerUlt,
          };
        case "healer_heal":
          return {
            title: "회복 마법",
            message: "대상 1명의 생명력을 1 회복했습니다.",
            imageUrl: imgHealerHeal,
          };
        default:
          return {
            title: "능력 사용",
            message: "능력을 사용했습니다.",
          };
      }
    }
    case "PERSONAL_CARD_USED": {
      const cardType = p.cardType as string | undefined;
      if (cardType === "magnifier") {
        const mode = p.mode as string | undefined;
        const modeLabel =
          mode === "magnifier3" ? "돋보기 3장" : "돋보기 2장";
        return {
          title: "돋보기 사용",
          message: `${modeLabel}을 사용해 누군가의 정보를 확인했습니다.`,
          imageUrl: imgCardMagnifier,
        };
      }
      if (cardType === "beer") {
        return {
          title: "맥주 사용",
          message: "맥주를 마셔 생명력을 1 회복했습니다.",
          imageUrl: imgCardBeer,
        };
      }
      if (cardType === "knife") {
        return {
          title: "칼 사용",
          message: "칼로 다른 플레이어를 공격했습니다.",
          imageUrl: imgCardKnife,
        };
      }
      if (cardType === "bomb") {
        return {
          title: "폭탄 설치",
          message: "다른 플레이어에게 폭탄을 설치했습니다.",
          imageUrl: imgCardBomb,
        };
      }
      return {
        title: "카드 사용",
        message: "카드를 사용했습니다.",
      };
    }
    case "PERSONAL_CARD_GIVEN": {
      const cardType = p.cardType as string | undefined;
      const cardName =
        cardType === "magnifier"
          ? "돋보기"
          : cardType === "knife"
            ? "칼"
            : cardType === "bomb"
              ? "폭탄"
              : cardType === "beer"
                ? "맥주"
                : "카드";
      return {
        title: "카드 양도",
        message: `${cardName} 카드를 다른 플레이어에게 건넸습니다.`,
        imageUrl: imgCardTransfer,
      };
    }
    case "PERSONAL_CARD_RECEIVED": {
      const cardType = p.cardType as string | undefined;
      const cardName =
        cardType === "magnifier"
          ? "돋보기"
          : cardType === "knife"
            ? "칼"
            : cardType === "bomb"
              ? "폭탄"
              : cardType === "beer"
                ? "맥주"
                : "카드";
      return {
        title: "카드 수신",
        message: `${cardName} 카드를 다른 플레이어로부터 받았습니다.`,
        imageUrl: imgCardTransfer,
      };
    }
    case "PERSONAL_HEALED":
      return {
        title: "회복 마법",
        message: "누군가의 회복 마법으로 생명력이 회복되었습니다.",
        imageUrl: imgHealerHeal,
      };
    case "PERSONAL_FEARED":
      return {
        title: "겁주기 당함",
        message: "겁주기 효과에 걸려 일정 시간 동안 행동할 수 없습니다.",
        imageUrl: imgFeared,
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

