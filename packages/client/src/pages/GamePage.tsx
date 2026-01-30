import { useState, useEffect, useCallback } from "react";
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
import type {
  UiAbility,
  UiCard,
  UiGameState,
  UiPlayer,
  UiRole,
  UiTeam,
} from "@/types/game-ui";
import { wsClient } from "@/api/ws";
import { useClientStore } from "@/stores/clientStore";
import { useFoggedGameStore } from "@/stores/foggedGameStore";
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

  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "error"
  >("connecting");

  // FoggedGameState → UiGameState 매핑
  useEffect(() => {
    if (!foggedState || !roomId) return;
    setGameState(mapFoggedToUi(foggedState, roomId));
    setConnectionStatus((prev) =>
      prev === "connected" ? prev : "connected",
    );
  }, [foggedState, roomId]);

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

  useEffect(() => {
    if (!roomId || !session) return;

    setConnectionStatus((prev) =>
      prev === "connected" ? "reconnecting" : "connecting",
    );

    wsClient.connect({
      roomId,
      gameId: null,
      onEnd: (payload) => {
        const endState = payload.endState as any;
        if (!endState || !gameState) return;

        const myResult = endState.results.find(
          (r: any) => r.playerId === gameState.myPlayerId,
        );

        const isVictory = !!myResult?.win;
        const winningTeam = endState.reason === "MAWANG_DEAD" ? "good" : "evil";

        const revealed = endState.results.map((r: any) => ({
          id: r.playerId,
          nickname: r.nickname,
          isDead: !r.alive,
          roleName: r.role,
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
              : "모든 용사가 사망했습니다!",
        });
      },
      onError: (msg) => {
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

  // 손패 제한 체크
  useEffect(() => {
    if (mustDiscard) {
      setShowDiscard(true);
    }
  }, [mustDiscard, myPlayer.hand.length, gameState.settings.handLimit]);

  // 카드 드로우 타이머
  useEffect(() => {
    const interval = setInterval(() => {
      setGameState((prev) => ({
        ...prev,
        nextCardDrawInSeconds: Math.max(0, prev.nextCardDrawInSeconds - 1),
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 카드 사용 가능 여부
  const canUseCard = useCallback(() => {
    if (!selectedCard) return false;
    if (connectionStatus !== "connected") return false;
    if (mustDiscard) return false;
    if (myPlayer.status.isIntimidated) return false;
    if (selectedCard.type === "beer") return true;
    return selectedPlayerId !== null;
  }, [selectedCard, selectedPlayerId, myPlayer.status.isIntimidated, mustDiscard]);

  // 카드 양도 가능 여부
  const canTransferCard = useCallback(() => {
    if (!selectedCard) return false;
    if (connectionStatus !== "connected") return false;
    if (mustDiscard) return false;
    if (myPlayer.status.isIntimidated) return false;
    return selectedPlayerId !== null;
  }, [selectedCard, selectedPlayerId, myPlayer.status.isIntimidated, mustDiscard]);

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
    setSelectedPlayerId(null);
  };

  // 게임 종료 테스트용
  const handleGameEnd = (isGoodTeamWin: boolean) => {
    const winningTeam: "good" | "evil" = isGoodTeamWin ? "good" : "evil";
    const myTeam = myPlayer.role?.team as UiTeam | undefined;
    const isVictory =
      myTeam === winningTeam || (myTeam === "citizen" && winningTeam === "good");

    const revealed = gameState.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isDead: p.isDead,
      roleName: p.role?.name || "???",
      roleKey: p.role?.id,
      team: (p.role?.team ?? "citizen") as UiTeam,
      isWinner:
        (p.role?.team === winningTeam ||
          (p.role?.team === "citizen" && winningTeam === "good")) ?? false,
    }));

    setRevealedPlayers(revealed);
    setGameResult({
      isVictory,
      winningTeam,
      reason: isGoodTeamWin ? "마왕이 사망했습니다!" : "모든 용사가 사망했습니다!",
    });
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
    const base = buildActionBase();
    if (!base) return;

    const skillKey = abilityId as any;

    wsClient.sendAction({
      ...base,
      actionType: "ability",
      data: {
        skillKey,
        targetPlayerId: selectedPlayerId,
        clientNowMs: Date.now(),
      },
    });
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
          onUseAbility={handleUseAbility}
          disabled={isIntimidated || mustDiscard}
        />

        {/* 카드 패 */}
        <CardHand
          cards={myPlayer.hand}
          selectedCardId={selectedCardId}
          onSelectCard={setSelectedCardId}
          disabled={isIntimidated || mustDiscard}
        />

        {/* 카드 액션 */}
        {selectedCard && !mustDiscard && (
          <CardActions
            selectedCard={selectedCard}
            selectedPlayerName={selectedPlayer?.nickname || null}
            allHandCards={myPlayer.hand}
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
        playerId={gameState.myPlayerId}
      />

      {/* 개발용 게임 종료 테스트 버튼 */}
      <div className="fixed top-20 right-2 flex flex-col gap-1 z-50">
        <Button
          size="sm"
          variant="outline"
          className="text-xs opacity-50 hover:opacity-100"
          onClick={() => handleGameEnd(true)}
        >
          🏆 선팀 승리
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs opacity-50 hover:opacity-100"
          onClick={() => handleGameEnd(false)}
        >
          💀 악팀 승리
        </Button>
      </div>
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
      description: "대상 1명에게 3 데미지를 입히는 강력한 일회용 기술입니다.",
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
    };
  });

  // 슬레이어의 필살기는 1회 기술이므로, 이미 사용했다면 사실상 재사용 불가로 표시
  if (roleKey === "slayer") {
    const ultUsed = state.me.effects.some((e) => e.kind === "slayerUltUsed");
    if (ultUsed && abilities.length > 0) {
      const bigCooldown = 3600; // 1시간짜리 가짜 쿨타임으로 비활성화
      abilities.forEach((ability) => {
        ability.cooldown = bigCooldown;
        ability.lastUsedAt = state.meta.nowMs;
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
      const bomb = effects.find((e) => e.kind === "bomb");
      if (bomb && "explodeAtMs" in bomb) {
        const remainingSec = Math.max(
          0,
          Math.floor((bomb.explodeAtMs - nowMs) / 1000),
        );
        status.hasBomb = { remainingSeconds: remainingSec, damage: 2 };
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
    }

    const knownInfo: UiPlayer["knownInfo"] = {};
    if (isMe) {
      for (const [targetId, roles] of Object.entries(
        state.me.know.byTarget,
      )) {
        const entry: { team?: UiTeam; roleName?: string; roleKey?: string } = {};

        const teamKnown = roles.find((r) => r.kind === "team");
        if (teamKnown) {
          entry.team = teamKnown.team === "good" ? "good" : "evil";
        }

        const roleKnown = roles.find((r) => r.kind === "role");
        if (roleKnown) {
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

  const uiState: UiGameState = {
    roomId,
    myPlayerId: myId,
    nextCardDrawInSeconds: Math.max(
      0,
      Math.floor((state.timers.nextDrawAtMs - state.meta.nowMs) / 1000),
    ),
    gamePhase: state.meta.state === "running" ? "playing" : "ended",
    settings: {
      cardDrawInterval: 0,
      bombTimer: 0,
      handLimit: state.me.hand.length,
      fearKingReviveHp: 0,
      chaosKingPersistTime: 0,
    },
    eventLog: [],
    players,
  };

  return uiState;
}

