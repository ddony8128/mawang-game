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
  UiCard,
  UiGameEvent,
  UiGameState,
  UiPlayer,
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
    team: UiTeam;
    isWinner: boolean;
  }[]>([]);

  // FoggedGameState → UiGameState 매핑
  useEffect(() => {
    if (!foggedState || !roomId) return;
    setGameState(mapFoggedToUi(foggedState, roomId));
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

  // TODO: 실제 FoggedGameState -> UiGameState 매핑 및 wsClient 연결
  useEffect(() => {
    if (!roomId || !session) return;

    wsClient.connect({
      roomId,
      gameId: null,
      onEnd: () => {
        // 결과 화면 전환은 WebSocket end payload 와 ResultPage 설계에 맞춰 이후 연동
      },
      onError: () => {
        // v1: 단순히 로비로 돌려보낸다.
        navigate(`/room/${roomId}`);
      },
    });

    return () => {
      wsClient.disconnect("navigation");
    };
  }, [roomId, session, navigate]);

  // 손패 제한 체크
  useEffect(() => {
    if (myPlayer.hand.length > gameState.settings.handLimit) {
      setShowDiscard(true);
    }
  }, [myPlayer.hand.length, gameState.settings.handLimit]);

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
    if (myPlayer.status.isIntimidated) return false;
    if (selectedCard.type === "beer") return true;
    return selectedPlayerId !== null;
  }, [selectedCard, selectedPlayerId, myPlayer.status.isIntimidated]);

  // 카드 양도 가능 여부
  const canTransferCard = useCallback(() => {
    if (!selectedCard) return false;
    if (myPlayer.status.isIntimidated) return false;
    return selectedPlayerId !== null;
  }, [selectedCard, selectedPlayerId, myPlayer.status.isIntimidated]);

  const appendLog = (entry: UiGameEvent) => {
    setGameState((prev) => ({
      ...prev,
      eventLog: [entry, ...prev.eventLog],
    }));
  };

  const handleUseCard = () => {
    if (!canUseCard() || !selectedCard) return;

    let effectResult:
      | {
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
        }
      | undefined;

    switch (selectedCard.type) {
      case "sword":
        effectResult = { type: "damage", value: 1 };
        break;
      case "beer":
        effectResult = { type: "heal", value: 1 };
        break;
      case "bomb":
        effectResult = { type: "bomb_placed" };
        break;
      case "magnifier":
        effectResult = { type: "info_team", team: "evil" };
        break;
    }

    setCardEffect({
      card: selectedCard,
      targetPlayer: selectedPlayer || null,
      effectResult,
    });

    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === prev.myPlayerId
          ? {
              ...p,
              hand: p.hand.filter((c) => c.id !== selectedCard.id),
            }
          : p
      ),
    }));

    appendLog({
      id: Date.now().toString(),
      timestamp: Date.now(),
      type: "card_use",
      message: `${selectedCard.name}을(를) 사용했습니다`,
    });

    setSelectedCardId(null);
    setSelectedPlayerId(null);
  };

  const handleTransferCard = () => {
    if (!canTransferCard() || !selectedCard) return;

    setCardEffect({
      card: selectedCard,
      targetPlayer: selectedPlayer || null,
      effectResult: { type: "transfer" },
    });

    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === prev.myPlayerId
          ? {
              ...p,
              hand: p.hand.filter((c) => c.id !== selectedCard.id),
            }
          : p
      ),
    }));

    appendLog({
      id: Date.now().toString(),
      timestamp: Date.now(),
      type: "card_transfer",
      message: `${selectedPlayer?.nickname}에게 ${selectedCard.name}을(를) 양도했습니다`,
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
    setNotification({
      id: Date.now().toString(),
      type: "ability_use",
      title: "능력 사용!",
      message: "무적방패를 발동했습니다. 1분간 피해를 받지 않습니다.",
      iconType: "heal",
    });

    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === prev.myPlayerId
          ? {
              ...p,
              status: { ...p.status, isInvincible: { remainingSeconds: 60 } },
              role: p.role
                ? {
                    ...p.role,
                    abilities: p.role.abilities.map((a) =>
                      a.id === abilityId ? { ...a, lastUsedAt: Date.now() } : a
                    ),
                  }
                : undefined,
            }
          : p
      ),
    }));
  };

  const handleDiscard = (cardId: string) => {
    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === prev.myPlayerId
          ? { ...p, hand: p.hand.filter((c) => c.id !== cardId) }
          : p
      ),
    }));

    const remainingCards = myPlayer.hand.length - 1;
    if (remainingCards <= gameState.settings.handLimit) {
      setShowDiscard(false);
    }
  };

  const openDrawer = (tab: "rules" | "log" | "memo") => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  };

  const isIntimidated = !!myPlayer.status.isIntimidated;

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col">
      {/* 상단 바 */}
      <GameTopBar
        player={myPlayer}
        nextCardDrawInSeconds={gameState.nextCardDrawInSeconds}
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
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border/50">
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
          disabled={isIntimidated}
        />

        {/* 카드 패 */}
        <CardHand
          cards={myPlayer.hand}
          selectedCardId={selectedCardId}
          onSelectCard={setSelectedCardId}
          disabled={isIntimidated}
        />

        {/* 카드 액션 */}
        {selectedCard && (
          <CardActions
            selectedCard={selectedCard}
            selectedPlayerName={selectedPlayer?.nickname || null}
            onUseCard={handleUseCard}
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

function mapFoggedToUi(state: FoggedGameState, roomId: string): UiGameState {
  const myId = state.me.playerId;

  const players: UiPlayer[] = state.players.map((p) => ({
    id: p.playerId,
    nickname: p.nickname,
    hp: p.hp,
    maxHp: 3,
    isDead: !p.alive,
    hand:
      p.playerId === myId
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
        : [],
    status: {},
    knownInfo: {},
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

