import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Book, Scroll, StickyNote } from "lucide-react";

import GameTopBar from "@/components/game/GameTopBar";
import PlayerList from "@/components/game/PlayerList";
import CardHand from "@/components/game/CardHand";
import CardActions from "@/components/game/CardActions";
import AbilityBar from "@/components/game/AbilityBar";
import GameNotificationModal from "@/components/game/GameNotificationModal";
import DiscardModal from "@/components/game/DiscardModal";
import GameDrawer from "@/components/game/GameDrawer";
import CardEffectModal from "@/components/game/CardEffectModal";
import GameResultModal from "@/components/game/GameResultModal";
import PlayerRevealModal from "@/components/game/PlayerRevealModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  UiAbility,
  UiCard,
  UiGameEvent,
  UiGameState,
  UiPlayer,
  UiRole,
  UiTeam,
} from "@/types/game-ui";
import type { SkillKey, RoleKey } from "@/types/identity";
import { wsClient } from "@/api/ws";
import { useClientStore } from "@/stores/clientStore";
import { useFoggedGameStore } from "@/stores/foggedGameStore";
import { useGameResultStore } from "@/stores/resultStore";
import { useUIStore } from "@/stores/uiStore";
import roleMawangFear from "@/assets/role/공포의_마왕.png";
import roleMawangTroll from "@/assets/role/분탕의_마왕.png";
import roleAide from "@/assets/role/참모.png";
import roleFallen from "@/assets/role/타락자.png";
import roleParryman from "@/assets/role/패링맨.png";
import roleSlayer from "@/assets/role/슬레이어.png";
import roleSage from "@/assets/role/현자.png";
import roleHealer from "@/assets/role/힐러.png";
import roleWeakling from "@/assets/role/약골.png";
import roleCoward from "@/assets/role/겁쟁이.png";
import roleMadman from "@/assets/role/정신병자.png";
import roleExperiment from "@/assets/role/실험체.png";
import type { FoggedGameState } from "@/types/foggedGame";
import { Button } from "@/components/ui/button";

// FoggedGameState → UiGameState 매핑에 사용하는 최소 헬퍼만 남긴다.

export function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const { sessions } = useClientStore();
  const session = roomId ? sessions[roomId] : undefined;
  const foggedState = useFoggedGameStore((s) => s.state);

  const [gameState, setGameState] = useState<UiGameState | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"rules" | "log" | "memo">("rules");
  const [notification, setNotification] = useState<{
    id: string;
    type: string;
    title: string;
    message: string;
    iconType?:
      | "sword"
      | "bomb"
      | "beer"
      | "intimidate"
      | "magnifier"
      | "transfer"
      | "death"
      | "reveal"
      | "heal";
  } | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);

  const [cardEffect, setCardEffect] = useState<{
    card: UiCard;
    targetPlayer: UiPlayer | null;
    effectResult?: {
      type:
        | "damage"
        | "heal"
        | "bomb_placed"
        | "info_team"
        | "info_role"
        | "transfer";
      value?: number;
      team?: "good" | "evil";
      roleName?: string;
    };
  } | null>(null);

  const [gameResult, setGameResult] = useState<{
    isVictory: boolean;
    winningTeam: "good" | "evil";
    reason: string;
  } | null>(null);
  const [showPlayerReveal, setShowPlayerReveal] = useState(false);

  const [revealedPlayers, setRevealedPlayers] = useState<{
    id: string;
    nickname: string;
    isDead: boolean;
    roleName: string;
    roleKey?: string;
    team: UiTeam;
    isWinner: boolean;
  }[]>([]);

  const [selectedAbilityId, setSelectedAbilityId] = useState<SkillKey | null>(null);
  // 돋보기 다중 선택(최대 3장)을 위한 상태
  const [selectedMagnifierIds, setSelectedMagnifierIds] = useState<string[]>([]);

  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "error"
  >("connecting");

  // 분탕의 마왕 가면놀이(1회성) 사용 시, 위장할 역할을 선택하기 위한 모달 상태
  const [maskSelectOpen, setMaskSelectOpen] = useState(false);
  const [selectedFakeRole, setSelectedFakeRole] = useState<RoleKey | null>(null);

  const setEndState = useGameResultStore((s) => s.setEndState);
  const uiStore = useUIStore();
  const [hasShownRoleIntro, setHasShownRoleIntro] = useState(false);

  // FoggedGameState → UiGameState 매핑
  useEffect(() => {
    if (!foggedState || !roomId) return;
    setGameState(mapFoggedToUi(foggedState, roomId));
    setConnectionStatus((prev) =>
      prev === "connected" ? prev : "connected",
    );
  }, [foggedState, roomId]);

  // 게임 시작 시 역할 소개 모달 (당신은 ~~입니다 / 역할 설명 / 능력 안내)
  useEffect(() => {
    if (!gameState || hasShownRoleIntro) return;

    const me = gameState.players.find((p) => p.id === gameState.myPlayerId);
    if (!me || !me.role) return;

    const roleKey = me.role.id as RoleKey;
    const roleName = me.role.name;

    const ROLE_ICON_URL: Record<string, string> = {
      mawang_fear: roleMawangFear,
      mawang_troll: roleMawangTroll,
      aide: roleAide,
      fallen: roleFallen,
      parryman: roleParryman,
      slayer: roleSlayer,
      sage: roleSage,
      healer: roleHealer,
      weakling: roleWeakling,
      coward: roleCoward,
      madman: roleMadman,
      experiment_host: roleExperiment,
    };

    const isMawang =
      roleKey === "mawang_fear" || roleKey === "mawang_troll";
    const isTraitor = roleKey === "aide" || roleKey === "fallen";
    const isHero =
      roleKey === "parryman" ||
      roleKey === "slayer" ||
      roleKey === "sage" ||
      roleKey === "healer";

    let objectiveLine = "";
    if (isMawang) {
      objectiveLine = "배신자의 도움을 받아 용사들을 처치하세요.";
    } else if (isTraitor) {
      objectiveLine = "마왕을 도와 용사들을 처치하세요.";
    } else if (isHero) {
      objectiveLine = "마왕을 처치하세요.";
    } else {
      // 시민 계열
      objectiveLine = "용사들이 마왕을 처치할 수 있도록 도우세요.";
    }

    const abilityLines =
      me.role.abilities.length > 0
        ? me.role.abilities
            .map((a) => `- ${a.name}: ${a.description}`)
            .join("\n")
        : "";

    const messageParts: string[] = [];
    messageParts.push(`당신은 ${roleName}입니다.`);
    if (objectiveLine) {
      messageParts.push(objectiveLine);
    }
    if (abilityLines) {
      messageParts.push(`능력:\n${abilityLines}`);
    }

    uiStore.pushModal({
      id: `role_intro_${roomId ?? "unknown"}_${Date.now()}`,
      title: `당신은 ${roleName}입니다`,
      message: messageParts.join("\n\n"),
      createdAtMs: Date.now(),
      imageUrl: ROLE_ICON_URL[roleKey] ?? undefined,
    });

    setHasShownRoleIntro(true);
  }, [gameState, hasShownRoleIntro, roomId, uiStore]);

  // WS 연결 시작 (gameState 가 아직 없어도 roomId / session 만 있으면 바로 연결)
  useEffect(() => {
    if (!roomId || !session) return;

    setConnectionStatus((prev) =>
      prev === "connected" ? "reconnecting" : "connecting",
    );

    wsClient.connect({
      roomId,
      gameId: null,
      onEnd: (payload) => {
        const endState = payload.endState;
        if (!endState) return;

        // 전역 스토어에 종료 상태 저장 (ResultPage 에서 사용)
        setEndState(endState);

        // 내 플레이어 id 는 gameState 가 있으면 거기서, 없으면 세션에서 가져온다.
        const myPlayerId = gameState?.myPlayerId ?? session?.roomPlayerId ?? null;
        if (!myPlayerId) return;

        const myResult = endState.results.find(
          (r) => r.playerId === myPlayerId,
        );

        const isVictory = !!myResult?.win;
        const winningTeam: UiTeam =
          endState.reason === "MAWANG_DEAD" ? "good" : "evil";

        const revealed = endState.results.map((r) => ({
          id: r.playerId,
          nickname: r.nickname,
          isDead: !r.alive,
          roleName: ROLE_DISPLAY_NAME[r.role] ?? r.role,
          roleKey: r.role,
          team: r.team === "good" ? ("good" as UiTeam) : ("evil" as UiTeam),
          isWinner: !!r.win,
        }));

        setRevealedPlayers(revealed);
        setGameResult({
          isVictory,
          winningTeam,
          reason:
            endState.reason === "MAWANG_DEAD"
              ? "마왕이 사망했습니다!"
              : endState.reason === "ALL_HERO_DEAD"
                ? "모든 용사가 사망했습니다!"
                : "게임이 중단되었습니다.",
        });
      },
      onError: (msg) => {
        // 서버에서 오는 에러를 콘솔에 로깅해 원인을 파악한다.
        // payload.code, payload.message, payload.next 값을 확인하면
        // 왜 로비(/rooms)로 이동하는지 정확히 알 수 있다.
        // 예) GAME_NOT_FOUND, AUTH_FAILED, NOT_IN_GAME 등
        // eslint-disable-next-line no-console
        console.error("[GamePage][WS error]", msg.payload);

        const next = msg.payload.next;
        if (next === "retry_ready") {
          // v1: 짧은 대기 후 ready 재전송 시도
          setConnectionStatus("reconnecting");
          setTimeout(() => {
            wsClient.connect({
              roomId,
              gameId: null,
              onEnd: () => {},
              onError: () => {
                navigate(`/rooms`);
              },
            });
          }, 2000);
        } else if (next === "go_lobby") {
          setConnectionStatus("error");
          navigate(`/rooms`);
        }
      },
    });

    return () => {
      wsClient.disconnect("navigation");
    };
  }, [roomId, session, navigate]);

  // 손패 제한 체크 (gameState 가 아직 없을 수도 있으므로 내부에서 방어)
  useEffect(() => {
    if (!gameState) return;
    const me = gameState.players.find((p) => p.id === gameState.myPlayerId);
    if (!me) return;
    const needDiscard = me.hand.length > gameState.settings.handLimit;
    // 현재 손패 상태에 따라 버리기 모달 열림 여부를 항상 동기화한다.
    setShowDiscard(needDiscard);
  }, [gameState]);

  // 카드 드로우/상태(폭탄, 겁주기, 무적) 타이머 (gameState 가 null 인 경우를 방어)
  useEffect(() => {
    const interval = setInterval(() => {
      setGameState((prev) => {
        if (!prev) return prev;

        const nextPlayers = prev.players.map((p) => {
          const nextStatus = { ...p.status };

          if (nextStatus.bombs) {
            nextStatus.bombs = nextStatus.bombs.map((bomb) => ({
              ...bomb,
              remainingSeconds: Math.max(0, bomb.remainingSeconds - 1),
            }));
          }

          if (nextStatus.isIntimidated) {
            const nextSec = Math.max(
              0,
              nextStatus.isIntimidated.remainingSeconds - 1,
            );
            nextStatus.isIntimidated =
              nextSec > 0
                ? { ...nextStatus.isIntimidated, remainingSeconds: nextSec }
                : undefined;
          }

          if (nextStatus.isInvincible) {
            const nextSec = Math.max(
              0,
              nextStatus.isInvincible.remainingSeconds - 1,
            );
            nextStatus.isInvincible =
              nextSec > 0
                ? { ...nextStatus.isInvincible, remainingSeconds: nextSec }
                : undefined;
          }

          if (nextStatus.trollStubborn) {
            const nextSec = Math.max(
              0,
              nextStatus.trollStubborn.remainingSeconds - 1,
            );
            nextStatus.trollStubborn =
              nextSec > 0
                ? { ...nextStatus.trollStubborn, remainingSeconds: nextSec }
                : undefined;
          }

          return {
            ...p,
            status: nextStatus,
          };
        });

        return {
          ...prev,
          nextCardDrawInSeconds: Math.max(
            0,
            prev.nextCardDrawInSeconds - 1,
          ),
          players: nextPlayers,
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!roomId) {
    return null;
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-muted-foreground text-sm">게임 상태를 불러오는 중...</div>
      </div>
    );
  }

  const myPlayer = gameState.players.find(
    (p) => p.id === gameState.myPlayerId
  )!;
  const selectedCard =
    myPlayer.hand.find((c) => c.id === selectedCardId) || null;
  const selectedPlayer = gameState.players.find(
    (p) => p.id === selectedPlayerId
  );

  const mustDiscard =
    myPlayer.hand.length > gameState.settings.handLimit;
  const isDead = myPlayer.isDead;

  const selectedAbility =
    myPlayer.role?.abilities.find((a) => a.id === selectedAbilityId) || null;

  // 카드 선택 로직 (돋보기는 최대 3장까지 다중 선택 허용)
  const handleSelectCard = (cardId: string | null) => {
    if (!cardId) {
      setSelectedCardId(null);
      setSelectedMagnifierIds([]);
      return;
    }

    const card = myPlayer.hand.find((c) => c.id === cardId);
    if (!card) return;

    if (card.type !== "magnifier") {
      // 다른 종류 카드를 누르면 그 카드만 선택, 돋보기 다중 선택은 초기화
      setSelectedCardId(cardId);
      setSelectedMagnifierIds([]);
      return;
    }

    // 돋보기: 최대 3장까지 토글 선택
    setSelectedCardId(cardId);
    setSelectedMagnifierIds((prev) => {
      if (prev.includes(cardId)) {
        // 다시 누르면 선택 해제
        return prev.filter((id) => id !== cardId);
      }
      if (prev.length >= 3) {
        // 3장을 이미 선택했다면 가장 오래된 것 하나를 빼고 새 것 추가
        return [...prev.slice(1), cardId];
      }
      return [...prev, cardId];
    });
  };

  // 카드 사용 가능 여부
  const canUseCard = () => {
    if (!selectedCard) return false;
    if (connectionStatus !== "connected") return false;
    if (isDead) return false;
    if (mustDiscard) return false;
    if (myPlayer.status.isIntimidated) return false;
    if (selectedCard.type === "beer") return true;
    return selectedPlayerId !== null;
  };

  // 카드 양도 가능 여부
  const canTransferCard = () => {
    if (!selectedCard) return false;
    if (connectionStatus !== "connected") return false;
    if (isDead) return false;
    if (mustDiscard) return false;
    if (myPlayer.status.isIntimidated) return false;
    return selectedPlayerId !== null;
  };

  const buildActionBase = () => {
    if (!roomId || !session || !foggedState) return null;
    const actionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
      actionId,
      roomId,
      gameId: foggedState.ids.gameId,
      actorPlayerId: foggedState.me.playerId,
    };
  };

  const handleUseCard = () => {
    if (!canUseCard() || !selectedCard) return;
    const base = buildActionBase();
    if (!base) return;

    const targetPlayerId = selectedPlayer ? selectedPlayer.id : null;
    const cardType =
      selectedCard.type === "sword" ? "knife" : selectedCard.type;

    wsClient.sendAction({
      ...base,
      actionType: "card_use",
      data: {
        cardInstanceId: selectedCard.id,
        cardType,
        targetPlayerId,
        useMode: "normal",
        clientNowMs: Date.now(),
      },
    });

    setSelectedCardId(null);
    setSelectedMagnifierIds([]);
    setSelectedPlayerId(null);
  };

  const handleTransferCard = () => {
    if (!canTransferCard() || !selectedCard) return;
    const base = buildActionBase();
    if (!base || !selectedPlayer) return;

    wsClient.sendAction({
      ...base,
      actionType: "card_give",
      data: {
        cardInstanceId: selectedCard.id,
        toPlayerId: selectedPlayer.id,
        clientNowMs: Date.now(),
      },
    });

    setSelectedCardId(null);
    setSelectedMagnifierIds([]);
    setSelectedPlayerId(null);
  };

  const handleGameResultConfirm = () => {
    setGameResult(null);
    setShowPlayerReveal(true);
  };

  const handlePlayerRevealConfirm = () => {
    setShowPlayerReveal(false);
    navigate(`/room/${roomId}/result`);
  };

  const handleUseAbility = (abilityId: string) => {
    if (connectionStatus !== "connected") return;

    // 능력 버튼 클릭은 "선택/해제"만 담당한다.
    setSelectedAbilityId((prev) =>
      prev === (abilityId as SkillKey) ? null : (abilityId as SkillKey),
    );
  };

  const handleDiscard = (cardId: string) => {
    if (connectionStatus !== "connected") return;
    const base = buildActionBase();
    if (!base) return;

    wsClient.sendAction({
      ...base,
      actionType: "discard",
      data: {
        cardInstanceIds: [cardId],
        clientNowMs: Date.now(),
      },
    });

    setShowDiscard(false);
  };

  const openDrawer = (tab: "rules" | "log" | "memo") => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  };

  const isIntimidated = !!myPlayer.status.isIntimidated;

  const abilityRequiresTarget = (abilityId: SkillKey | null): boolean => {
    if (!abilityId) return false;
    // 규칙서 기준: 대상이 필요한 능력들
    return (
      abilityId === "mawang_fear" || // 겁주기
      abilityId === "traitor_beer" || // 술자리 권유
      abilityId === "healer_heal" || // 회복 마법
      abilityId === "slayer_ult" // 짱쎈 필살기
    );
  };

  const canUseSelectedAbility = () => {
    if (!selectedAbility) return false;
    if (connectionStatus !== "connected") return false;
    if (isDead) return false;
    if (mustDiscard) return false;
    if (myPlayer.status.isIntimidated) return false;
    if (abilityRequiresTarget(selectedAbilityId) && !selectedPlayerId) {
      return false;
    }
    return true;
  };

  const handleConfirmAbilityUse = () => {
    if (!canUseSelectedAbility()) return;
    if (!selectedAbilityId) return;

    // 분탕의 마왕: 가면놀이는 위장 역할 선택 모달을 먼저 띄운다.
    if (selectedAbilityId === "mawang_mask") {
      setSelectedFakeRole(null);
      setMaskSelectOpen(true);
      return;
    }

    const base = buildActionBase();
    if (!base) return;

    wsClient.sendAction({
      ...base,
      actionType: "ability",
      data: {
        skillKey: selectedAbilityId,
        targetPlayerId: selectedPlayerId,
        clientNowMs: Date.now(),
      },
    });

    setSelectedAbilityId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col">
      {connectionStatus !== "connected" && (
        <div className="w-full bg-amber-900/80 text-amber-50 text-[11px] text-center py-1">
          {connectionStatus === "connecting" && "서버에 연결 중입니다..."}
          {connectionStatus === "reconnecting" &&
            "서버 재연결 중입니다. 잠시만 기다려 주세요."}
          {connectionStatus === "error" &&
            "연결 오류가 발생했습니다. 로비로 이동합니다."}
        </div>
      )}
      {/* 상단 바 */}
      <GameTopBar
        player={myPlayer}
        nextCardDrawInSeconds={gameState.nextCardDrawInSeconds}
        connectionStatus={connectionStatus}
      />

      {/* 플레이어 리스트 */}
      <PlayerList
        players={gameState.players}
        myPlayerId={gameState.myPlayerId}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={setSelectedPlayerId}
        knownInfo={myPlayer.knownInfo}
      />

      {/* 하단 고정 영역 */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border/50 transition-opacity ${
          connectionStatus !== "connected" ? "opacity-80" : "opacity-100"
        }`}
      >
        {/* 빠른 액션 버튼 */}
        <div className="flex gap-2 px-4 py-2 border-b border-border/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDrawer("rules")}
            className="flex-1"
          >
            <Book className="w-4 h-4 mr-1" />
            규칙
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDrawer("log")}
            className="flex-1"
          >
            <Scroll className="w-4 h-4 mr-1" />
            로그
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDrawer("memo")}
            className="flex-1"
          >
            <StickyNote className="w-4 h-4 mr-1" />
            메모
          </Button>
        </div>

        {/* 능력 바 */}
        <AbilityBar
          abilities={myPlayer.role?.abilities || []}
          selectedAbilityId={selectedAbilityId}
          onSelectAbility={handleUseAbility}
          disabled={isDead || isIntimidated || mustDiscard}
          disabledReason={
            isDead ? "dead" : mustDiscard ? "mustDiscard" : isIntimidated ? "intimidated" : undefined
          }
        />
        <div className="px-4 py-1 border-t border-border/30 bg-card/95">
          <div className="max-w-3xl mx-auto flex items-center justify-between text-xs">
            <span className="text-muted-foreground truncate mr-2">
              {selectedAbility
                ? `선택된 능력: ${selectedAbility.name}${
                    abilityRequiresTarget(selectedAbilityId)
                      ? " (대상을 선택한 뒤 사용)"
                      : ""
                  }`
                : "사용할 능력을 선택한 뒤, 대상이 필요한 경우 플레이어를 선택하고 사용 버튼을 누르세요."}
            </span>
            <Button
              size="sm"
              variant="gold"
              disabled={!canUseSelectedAbility()}
              onClick={handleConfirmAbilityUse}
            >
              사용
            </Button>
          </div>
        </div>

        {/* 카드 패 */}
        <CardHand
          cards={myPlayer.hand}
          selectedCardId={selectedCardId}
          selectedCardIds={
            selectedMagnifierIds.length > 0
              ? selectedMagnifierIds
              : selectedCardId
                ? [selectedCardId]
                : []
          }
          onSelectCard={handleSelectCard}
          disabled={isDead || isIntimidated || mustDiscard}
        />

        {/* 카드 액션 (사망/겁주기 상태이거나 버리기 강제 시에는 완전히 비활성화) */}
        {selectedCard && !isDead && !mustDiscard && !isIntimidated && (
          <CardActions
            selectedCard={selectedCard}
            selectedPlayerName={selectedPlayer?.nickname || null}
            selectedMagnifierIds={selectedMagnifierIds}
            onUseSingleCard={handleUseCard}
            onUseMagnifier={(ids, mode) => {
              const base = buildActionBase();
              if (!base) return;
              const targetPlayerId = selectedPlayer ? selectedPlayer.id : null;
              wsClient.sendAction({
                ...base,
                actionType: "card_use",
                data: {
                  cardInstanceId: ids[0],
                  cardInstanceIds: ids,
                  cardType: "magnifier",
                  targetPlayerId,
                  useMode: mode,
                  clientNowMs: Date.now(),
                },
              });
            }}
            onTransferCard={handleTransferCard}
            onCancel={() => {
              setSelectedCardId(null);
              setSelectedPlayerId(null);
            }}
            canUse={canUseCard()}
            canTransfer={canTransferCard()}
          />
        )}

        <div className="h-4" />
      </div>

      {/* 알림 모달 */}
      <GameNotificationModal
        notification={notification}
        onConfirm={() => setNotification(null)}
      />

      {/* 카드 효과 모달 */}
      <CardEffectModal
        open={!!cardEffect}
        card={cardEffect?.card || null}
        targetPlayer={cardEffect?.targetPlayer || null}
        effectResult={cardEffect?.effectResult}
        onConfirm={() => setCardEffect(null)}
      />

      {/* 게임 결과 모달 */}
      <GameResultModal
        open={!!gameResult}
        result={gameResult}
        onConfirm={handleGameResultConfirm}
      />

      {/* 플레이어 공개 모달 */}
      <PlayerRevealModal
        open={showPlayerReveal}
        players={revealedPlayers}
        onConfirm={handlePlayerRevealConfirm}
      />

      {/* 버리기 모달 */}
      <DiscardModal
        open={showDiscard}
        cards={myPlayer.hand}
        handLimit={gameState.settings.handLimit}
        onDiscard={handleDiscard}
      />

      {/* 규칙/로그/메모 드로어 */}
      <GameDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        defaultTab={drawerTab}
        eventLog={gameState.eventLog}
        roomId={roomId || "test"}
        settings={gameState.settings}
      />

      {/* 분탕의 마왕: 가면놀이 위장 역할 선택 모달 */}
      <Dialog
        open={maskSelectOpen}
        onOpenChange={(open) => {
          if (!open) {
            setMaskSelectOpen(false);
            setSelectedFakeRole(null);
          }
        }}
      >
        <DialogContent className="bg-card border-border/60 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              위장할 역할 선택
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              이번 게임 동안 돋보기에 보일 당신의 역할을 선택하세요. 한 번
              선택하면 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              이 게임에 등장하는 모든 직업 중에서, 돋보기에 보일 당신의 가짜
              역할을 선택하세요.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {(Object.keys(ROLE_DISPLAY_NAME) as RoleKey[]).map((roleKey) => (
                <Button
                  key={roleKey}
                  type="button"
                  variant={
                    selectedFakeRole === roleKey ? "gold" : "secondary"
                  }
                  className="w-full justify-center text-xs"
                  onClick={() => setSelectedFakeRole(roleKey)}
                >
                  {ROLE_DISPLAY_NAME[roleKey] ?? roleKey}
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMaskSelectOpen(false);
                setSelectedFakeRole(null);
              }}
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedFakeRole || connectionStatus !== "connected"}
              onClick={() => {
                if (!selectedFakeRole) return;
                const base = buildActionBase();
                if (!base) return;
                wsClient.sendAction({
                  ...base,
                  actionType: "ability",
                  data: {
                    skillKey: "mawang_mask",
                    // 위장할 역할/팀/진영 정보
                    fakeRole: selectedFakeRole,
                    fakeTeam: "good",
                    fakeSide: "hero",
                    // 가면놀이 자체는 타겟이 필요 없으므로 null
                    targetPlayerId: null,
                    clientNowMs: Date.now(),
                  },
                });
                setMaskSelectOpen(false);
                setSelectedFakeRole(null);
                setSelectedAbilityId(null);
              }}
            >
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ROLE_DISPLAY_NAME: Record<string, string> = {
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

const ROLE_ABILITIES: Record<
  string,
  Array<{ id: string; name: string; description: string; cooldown: number }>
> = {
  mawang_fear: [
    {
      id: "mawang_fear",
      name: "겁주기",
      description: "대상 1명을 2분간 행동 불가 상태로 만듭니다. (쿨타임 3분)",
      cooldown: 180,
    },
  ],
  mawang_troll: [
    {
      id: "mawang_mask",
      name: "가면놀이",
      description: "이번 게임 동안 돋보기에 보일 자신의 역할을 위장합니다. (1회)",
      cooldown: 0,
    },
  ],
  fallen: [
    {
      id: "traitor_beer",
      name: "술자리 권유",
      description:
        "대상 1명의 다음 카드 뽑기에서 확정적으로 맥주를 뽑게 합니다. (쿨타임 3분)",
      cooldown: 180,
    },
  ],
  parryman: [
    {
      id: "parry_shield",
      name: "무적방패",
      description: "1분간 받는 피해를 모두 무효화합니다. (쿨타임 3분)",
      cooldown: 180,
    },
  ],
  slayer: [
    {
      id: "slayer_ult",
      name: "짱쎈 필살기",
      description: "대상 1명에게 2 데미지를 입히는 강력한 일회용 기술입니다.",
      cooldown: 0,
    },
  ],
  healer: [
    {
      id: "healer_heal",
      name: "회복 마법",
      description: "대상 1명의 생명력을 1 회복합니다. (쿨타임 3분)",
      cooldown: 180,
    },
  ],
};

function buildUiRole(state: FoggedGameState): UiRole | undefined {
  const roleKey = state.me.role;
  const displayName = ROLE_DISPLAY_NAME[roleKey];
  if (!displayName) return undefined;

  const team: UiTeam = state.me.team === "good" ? "good" : "evil";

  const abilityDefs = ROLE_ABILITIES[roleKey] ?? [];
  const cooldownMap = new Map<string, number>();
  for (const cd of state.me.cooldowns) {
    cooldownMap.set(cd.skillKey, cd.readyAtMs);
  }

  const abilities: UiAbility[] = abilityDefs.map((def) => {
    let lastUsedAt: number | undefined;
    if (def.cooldown > 0) {
      const readyAtMs = cooldownMap.get(def.id);
      if (typeof readyAtMs === "number") {
        lastUsedAt = readyAtMs - def.cooldown * 1000;
      }
    }

    return {
      id: def.id,
      name: def.name,
      description: def.description,
      cooldown: def.cooldown,
      lastUsedAt,
      used: false,
    };
  });

  // 1회성 스킬들: 사용 여부를 플래그로 표시해 UI 에서 비활성화한다.
  // 엔진은 이미 ONE_TIME_USED invalid 로직을 갖고 있으므로,
  // 여기서는 순수히 표시용이다.
  if (roleKey === "slayer") {
    const ultUsed = state.me.effects.some((e) => e.kind === "slayerUltUsed");
    if (ultUsed) {
      abilities.forEach((ability) => {
        if (ability.id === "slayer_ult") {
          ability.used = true;
        }
      });
    }
  }

  if (roleKey === "mawang_troll") {
    // 분탕의 마왕: 가면놀이는 1회성 스킬.
    // PERSONAL_SKILL_USED 로그에서 skillKey 로 사용 여부를 유추한다.
    const maskUsed = state.log.items.some(
      (item) =>
        item.type === "PERSONAL_SKILL_USED" &&
        item.payload?.skillKey === "mawang_mask",
    );
    if (maskUsed) {
      abilities.forEach((ability) => {
        if (ability.id === "mawang_mask") {
          ability.used = true;
        }
      });
    }
  }

  return {
    id: roleKey,
    name: displayName,
    team,
    abilities,
  };
}

function mapFoggedToUi(state: FoggedGameState, roomId: string): UiGameState {
  const myId = state.me.playerId;

  const nowMs = state.meta.nowMs;
  const myRole = buildUiRole(state);

  const players: UiPlayer[] = state.players.map((p) => {
    const isMe = p.playerId === myId;

    const hand: UiCard[] = isMe
      ? state.me.hand.map<UiCard>((c) => ({
          id: c.id,
          type: c.type === "knife" ? "sword" : c.type,
          name:
            c.type === "knife"
              ? "칼"
              : c.type === "bomb"
                ? "폭탄"
                : c.type === "beer"
                  ? "맥주"
                  : "돋보기",
          description: "",
        }))
      : [];

    const status: UiPlayer["status"] = {};

    if (isMe) {
      const effects = state.me.effects;
      const bombs = effects.filter((e) => e.kind === "bomb" && "explodeAtMs" in e);
      if (bombs.length > 0) {
        status.bombs = bombs.map((bomb) => {
          const remainingSec = Math.max(
            0,
            Math.floor(((bomb as any).explodeAtMs - nowMs) / 1000),
          );
          return { id: (bomb as any).id, remainingSeconds: remainingSec, damage: 2 };
        });
      }

      const feared = effects.find((e) => e.kind === "feared");
      if (feared && "untilMs" in feared) {
        const remainingSec = Math.max(
          0,
          Math.floor((feared.untilMs - nowMs) / 1000),
        );
        status.isIntimidated = { remainingSeconds: remainingSec };
      }

      const shield = effects.find((e) => e.kind === "shield");
      if (shield && "untilMs" in shield) {
        const remainingSec = Math.max(
          0,
          Math.floor((shield.untilMs - nowMs) / 1000),
        );
        status.isInvincible = { remainingSeconds: remainingSec };
      }

      // 분탕의 집념(일시 부활) 상태
      const stubborn = effects.find((e) => e.kind === "trollStubborn");
      if (stubborn && "untilMs" in stubborn) {
        const remainingSec = Math.max(
          0,
          Math.floor((stubborn.untilMs - nowMs) / 1000),
        );
        status.trollStubborn = { remainingSeconds: remainingSec };
      }
    }

    const knownInfo: UiPlayer["knownInfo"] = {};
    if (isMe) {
      for (const [targetId, roles] of Object.entries(
        state.me.know.byTarget,
      )) {
        const entry: { team?: UiTeam; roleName?: string; roleKey?: string } = {};

        const teamKnown = roles.find((r) => r.kind === "team");
        if (teamKnown && teamKnown.kind === "team") {
          entry.team = teamKnown.team === "good" ? "good" : "evil";
        }

        const roleKnown = roles.find((r) => r.kind === "role");
        if (roleKnown && roleKnown.kind === "role") {
          const name = ROLE_DISPLAY_NAME[roleKnown.role];
          if (name) {
            entry.roleName = name;
          }
          entry.roleKey = roleKnown.role;
        }

        if (entry.team || entry.roleName) {
          knownInfo[targetId] = entry;
        }
      }
    }

    return {
      id: p.playerId,
      nickname: p.nickname,
      hp: p.hp,
      maxHp: 3,
      isDead: !p.alive,
      hand,
      status,
      knownInfo,
      role: isMe ? myRole : undefined,
    };
  });

  const eventLog: UiGameEvent[] = state.log.items.map((item) => ({
    id: item.id,
    timestamp: item.atMs,
    // v1: 세부 타입은 UI 에서 크게 쓰이지 않으므로 ability_use 로 통일
    type: "ability_use",
    // modal=true 인 항목은 modalUi.message 를 그대로 사용해,
    // "알림" 에서 본 것과 동일한 내용을 로그에서도 볼 수 있게 한다.
    message: item.modalUi?.message || item.type,
  }));

  const uiState: UiGameState = {
    roomId,
    myPlayerId: myId,
    nextCardDrawInSeconds: Math.max(
      0,
      Math.floor((state.timers.nextDrawAtMs - state.meta.nowMs) / 1000),
    ),
    gamePhase: state.meta.state === "running" ? "playing" : "ended",
    settings: {
      cardDrawInterval: state.settings?.drawIntervalSec ?? 120,
      bombTimer: state.settings?.bombDelaySec ?? 300,
      handLimit: state.settings?.handLimit ?? 4,
      fearKingReviveHp: state.settings?.fearReviveHp ?? 3,
      chaosKingPersistTime: state.settings?.trollSurviveSec ?? 180,
      teamCounts: state.settings?.teamCounts ?? {
        traitor: 1,
        hero: 3,
        civil: 1,
      },
    },
    eventLog,
    players,
  };

  return uiState;
}

