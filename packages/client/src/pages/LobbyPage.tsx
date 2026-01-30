import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Crown,
  Lock,
  Users,
  Settings,
  Play,
  DoorClosed,
  Check,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  apiDeleteRoom,
  apiPatchRoomSettings,
  apiPollRoom,
  apiReadyRoom,
  apiStartRoom,
  ApiError,
} from "@/api/rest";
import type {
  RoomPlayerSummary,
  RoomSettings as ApiRoomSettings,
} from "@/types/rest";
import { useClientStore } from "@/stores/clientStore";

interface RoomSettings {
  cardDrawInterval: number;
  bombTimer: number;
  handLimit: number;
  fearKingReviveHp: number;
  chaosKingPersistTime: number;
  traitorCount: number;
  heroCount: number;
  citizenCount: number;
  gmEnabled: boolean;
  hostIsGM: boolean;
   gmFixedRoles: Record<string, string>;
}

export function LobbyPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const myRoomPlayerId = useClientStore((state) =>
    roomId ? state.sessions[roomId]?.roomPlayerId ?? null : null,
  );

  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [players, setPlayers] = useState<RoomPlayerSummary[]>([]);
  const [roomTitle, setRoomTitle] = useState<string>("마왕 잡으러 갈 사람!");

  const [settings, setSettings] = useState<RoomSettings>({
    cardDrawInterval: 3,
    bombTimer: 5,
    handLimit: 4,
    fearKingReviveHp: 3,
    chaosKingPersistTime: 3,
    traitorCount: 1,
    heroCount: 3,
    citizenCount: 1,
    gmEnabled: false,
    hostIsGM: false,
    gmFixedRoles: {},
  });

  const roomInfo = {
    title: "마왕 잡으러 갈 사람!",
    hasPassword: false,
    maxPlayers: 10,
  };

  const allOthersReady = players
    .filter((p) => !p.isHost)
    .every((p) => p.isReady);
  const canStart = isHost && allOthersReady && players.length >= 6;

  const handleToggleReady = async () => {
    if (!roomId) return;
    const next = !isReady;
    try {
      const res = await apiReadyRoom(roomId, next);
      setIsReady(res.isReady);
      // 내 준비 상태는 서버가 poll 응답에서 다시 내려주므로 여기서는 로컬 플래그만 갱신
    } catch (err) {
      console.error("failed to toggle ready", err);
    }
  };

  const handleStartGame = async () => {
    if (!canStart || !roomId) return;
    try {
      const res = await apiStartRoom(roomId, 5);
      const endsAt = res.countdown?.endsAtMs ?? Date.now() + 5000;
      const remain = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setCountdown(remain);
    } catch (err) {
      console.error("failed to start game", err);
    }
  };

  const handleCloseRoom = () => {
    setShowCloseConfirm(false);
    navigate("/");
  };

  // Countdown effect
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      navigate(`/room/${roomId}/game`);
      return;
    }
    const timer = setTimeout(() => setCountdown((prev) => (prev ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, navigate, roomId]);

  const syncFromPoll = useCallback(
    (data: Awaited<ReturnType<typeof apiPollRoom>>) => {
      setPlayers(data.players);

      const me = data.players.find(
        (p) => myRoomPlayerId && p.roomPlayerId === myRoomPlayerId,
      );

      setIsHost(!!me?.isHost);
      setIsReady(!!me?.isReady);
      setRoomTitle(data.room.roomTitle);
      if (data.countdown) {
        const endsAt = data.countdown.endsAtMs;
        const remain = Math.max(
          0,
          Math.ceil((endsAt - Date.now()) / 1000),
        );
        setCountdown(data.countdown.active ? remain : 0);
      }
    },
    [myRoomPlayerId],
  );

  // Poll room info 주기적으로
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const data = await apiPollRoom(roomId);
        if (!cancelled && !data.unchanged) {
          syncFromPoll(data);
        }
      } catch (err) {
        console.error("failed to poll room", err);
        if (!cancelled && err instanceof ApiError) {
          // 존재하지 않는 방이거나, 이 방에 대한 유효한 세션이 아닌 경우
          if (
            err.code === "NOT_FOUND" ||
            err.code === "AUTH_REQUIRED" ||
            err.code === "AUTH_FAILED" ||
            err.code === "NOT_IN_ROOM" ||
            err.code === "GAME_NOT_FOUND"
          ) {
            cancelled = true;
            navigate("/rooms");
            return;
          }
        }
      } finally {
        if (!cancelled) {
          setTimeout(tick, 2000);
        }
      }
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [roomId, syncFromPoll, navigate]);

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold truncate">{roomTitle}</h1>
              {/* 잠금 여부는 현재 poll 응답에 없으므로 아이콘은 숨김 */}
              {false && (
                <Lock className="w-4 h-4 text-accent" />
              )}
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-muted rounded-full text-sm">
              <Users className="w-4 h-4" />
              {players.length}/10
            </div>
          </div>

          {/* Host Controls */}
          {isHost && (
            <div className="flex gap-2 mt-3">
              <Button
                variant="gold"
                size="sm"
                onClick={handleStartGame}
                disabled={!canStart}
                className="flex-1"
              >
                <Play className="w-4 h-4 mr-1" />
                시작하기
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowCloseConfirm(true)}
              >
                <DoorClosed className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Player List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3 max-w-2xl mx-auto pb-24">
          {players.map((player, index) => {
            const isMe = myRoomPlayerId != null && player.roomPlayerId === myRoomPlayerId;
            return (
              <div
                key={player.roomPlayerId}
                className={`glass-card rounded-xl p-4 flex items-center gap-3 animate-fade-in ${
                  isMe ? "border-primary/50" : ""
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {player.isHost && (
                      <Crown className="w-4 h-4 text-accent shrink-0" />
                    )}
                    <span className="font-semibold truncate">
                      {player.nickname}
                      {isMe && <span className="text-primary ml-1">(나)</span>}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    전적: {player.wins}승 {player.losses}패
                  </p>
                </div>

                {!player.isHost && (
                  <div
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                      player.isReady
                        ? "bg-good/20 text-good"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {player.isReady ? (
                      <>
                        <Check className="w-4 h-4" />
                        준비
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4" />
                        대기
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!canStart && isHost && players.length < 6 && (
            <p className="text-center text-muted-foreground text-sm py-4">
              최소 6명이 필요합니다 (현재 {players.length}명)
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Footer - Ready Button (non-host) */}
      {!isHost && (
        <footer className="fixed bottom-0 left-0 right-0 p-4 bg-card/80 backdrop-blur-md border-t border-border/50">
          <div className="max-w-2xl mx-auto">
            <Button
              variant={isReady ? "outline" : "gold"}
              className="w-full"
              onClick={handleToggleReady}
            >
              {isReady ? "준비 취소" : "준비 완료"}
            </Button>
          </div>
        </footer>
      )}

      {/* Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-card border-border/50 max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gradient-gold">
              방 설정
            </DialogTitle>
            <DialogDescription className="sr-only">
              카드 드로우 주기, 폭탄 시한, 손패 제한, 마왕 관련 설정을 변경하는 대화상자입니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Card Settings */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground">
                카드 설정
              </h4>
              <SettingSelect
                label="카드 드로우 주기"
                value={String(settings.cardDrawInterval)}
                onChange={(v) =>
                  setSettings((s) => ({
                    ...s,
                    cardDrawInterval: Number(v),
                  }))
                }
                options={[
                  { value: "2", label: "2분" },
                  { value: "3", label: "3분" },
                  { value: "4", label: "4분" },
                ]}
              />
              <SettingSelect
                label="폭탄 시한"
                value={String(settings.bombTimer)}
                onChange={(v) =>
                  setSettings((s) => ({ ...s, bombTimer: Number(v) }))
                }
                options={[
                  { value: "1", label: "1분" },
                  { value: "3", label: "3분" },
                  { value: "5", label: "5분" },
                  { value: "7", label: "7분" },
                ]}
              />
              <SettingSelect
                label="손패 제한"
                value={String(settings.handLimit)}
                onChange={(v) =>
                  setSettings((s) => ({ ...s, handLimit: Number(v) }))
                }
                options={[
                  { value: "3", label: "3장" },
                  { value: "4", label: "4장" },
                  { value: "5", label: "5장" },
                ]}
              />
            </div>

            {/* Demon King Settings */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground">
                마왕 설정
              </h4>
              <SettingSelect
                label="공포의 마왕 부활 HP"
                value={String(settings.fearKingReviveHp)}
                onChange={(v) =>
                  setSettings((s) => ({
                    ...s,
                    fearKingReviveHp: Number(v),
                  }))
                }
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                ]}
              />
              <SettingSelect
                label="분탕의 마왕 집념 시간"
                value={String(settings.chaosKingPersistTime)}
                onChange={(v) =>
                  setSettings((s) => ({
                    ...s,
                    chaosKingPersistTime: Number(v),
                  }))
                }
                options={[
                  { value: "1", label: "1분" },
                  { value: "3", label: "3분" },
                  { value: "5", label: "5분" },
                ]}
              />
            </div>

            {/* Team Composition Settings */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground">
                팀 구성
              </h4>
              <SettingSelect
                label="배신자 수"
                value={String(settings.traitorCount)}
                onChange={(v) =>
                  setSettings((s) => ({
                    ...s,
                    traitorCount: Number(v),
                  }))
                }
                options={[
                  { value: "1", label: "1명" },
                  { value: "2", label: "2명" },
                ]}
              />
              <SettingSelect
                label="용사 수"
                value={String(settings.heroCount)}
                onChange={(v) =>
                  setSettings((s) => ({
                    ...s,
                    heroCount: Number(v),
                  }))
                }
                options={[
                  { value: "2", label: "2명" },
                  { value: "3", label: "3명" },
                  { value: "4", label: "4명" },
                ]}
              />
              <SettingSelect
                label="시민 수"
                value={String(settings.citizenCount)}
                onChange={(v) =>
                  setSettings((s) => ({
                    ...s,
                    citizenCount: Number(v),
                  }))
                }
                options={[
                  { value: "0", label: "0명" },
                  { value: "1", label: "1명" },
                  { value: "2", label: "2명" },
                  { value: "3", label: "3명" },
                ]}
              />
            </div>

            {/* GM 모드 설정 */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">
                GM 모드
              </h4>
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm">GM 모드 활성화</Label>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      gmEnabled: !s.gmEnabled,
                    }))
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    settings.gmEnabled
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {settings.gmEnabled ? "켜짐" : "꺼짐"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm">방장이 GM</Label>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      hostIsGM: !s.hostIsGM,
                    }))
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    settings.hostIsGM
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {settings.hostIsGM ? "예" : "아니오"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                GM 모드가 활성화되면 아래에서 지정한 고정 역할이 우선 적용되고,
                나머지 인원은 팀 구성 규칙에 따라 자동 배정됩니다.
              </p>

              {settings.gmEnabled && (
                <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                  <h5 className="text-xs font-semibold text-muted-foreground">
                    플레이어별 고정 역할
                  </h5>
                  <p className="text-[11px] text-muted-foreground">
                    각 플레이어에게 역할을 직접 지정할 수 있습니다.{" "}
                    <span className="font-medium">자동 배치</span>로 두면 위 팀 구성에 따라 랜덤 배정됩니다.
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {players.map((player) => {
                      const current =
                        settings.gmFixedRoles[player.roomPlayerId] ?? "auto";
                      return (
                        <div
                          key={player.roomPlayerId}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="truncate block">
                              {player.nickname}
                              {player.isHost && (
                                <span className="text-xs text-accent ml-1">
                                  (방장)
                                </span>
                              )}
                            </span>
                          </div>
                          <Select
                            value={current}
                            onValueChange={(value) =>
                              setSettings((s) => {
                                const next = { ...s.gmFixedRoles };
                                if (value === "auto") {
                                  delete next[player.roomPlayerId];
                                } else {
                                  next[player.roomPlayerId] = value;
                                }
                                return { ...s, gmFixedRoles: next };
                              })
                            }
                          >
                            <SelectTrigger className="w-40 bg-muted/50">
                              <SelectValue placeholder="자동 배치" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border max-h-60 overflow-y-auto">
                              <SelectItem value="auto">자동 배치</SelectItem>
                              {GM_ROLE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              닫기
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end w-full">
              {settingsError && (
                <p className="flex-1 text-xs text-red-400 whitespace-pre-line">
                  {settingsError}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  닫기
                </Button>
                <Button
                  variant="gold"
                  onClick={async () => {
                    if (!roomId) return;
                    try {
                      setSettingsError(null);
                      const apiSettings = toApiSettings(settings);
                      const res = await apiPatchRoomSettings(roomId, apiSettings);
                      setSettings(fromApiSettings(res.settings));
                      setShowSettings(false);
                    } catch (err) {
                      console.error("failed to save settings", err);
                      let message = "설정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.";
                      if (err instanceof ApiError) {
                        if (
                          typeof err.message === "string" &&
                          err.message.includes("teamCounts")
                        ) {
                          message =
                            "팀 구성 설정이 게임 설계 범위를 벗어났습니다.\n배신자 / 용사 / 시민 수를 다시 확인해 주세요.";
                        } else if (err.message) {
                          message = err.message;
                        }
                      }
                      setSettingsError(message);
                    }
                  }}
                >
                  저장
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Room Confirm Modal */}
      <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <DialogContent className="bg-card border-border/50 max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-center">
              방을 닫으시겠습니까?
            </DialogTitle>
            <DialogDescription className="sr-only">
              현재 방을 삭제하면 모든 플레이어가 방에서 나가게 됩니다.
            </DialogDescription>
          </DialogHeader>
          <p className="text-center text-muted-foreground text-sm">
            모든 플레이어가 퇴장됩니다.
          </p>
          <DialogFooter className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCloseConfirm(false)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={async () => {
                if (!roomId) return;
                try {
                  await apiDeleteRoom(roomId);
                } catch (err) {
                  console.error("failed to delete room", err);
                }
                handleCloseRoom();
              }}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Countdown Modal */}
      <Dialog open={countdown !== null} onOpenChange={() => {}}>
        <DialogContent className="bg-card border-primary/50 max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold">
              게임이 시작됩니다
            </DialogTitle>
            <DialogDescription className="sr-only">
              카운트다운이 끝나면 게임 화면으로 이동합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-6">
            <div className="text-6xl font-black text-gradient-evil animate-pulse">
              {countdown}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-sm">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-24 bg-muted/50">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// 변환 헬퍼: API RoomSettings <-> UI RoomSettings
function fromApiSettings(api: ApiRoomSettings | undefined): RoomSettings {
  if (!api) {
    return {
      cardDrawInterval: 3,
      bombTimer: 5,
      handLimit: 4,
      fearKingReviveHp: 3,
      chaosKingPersistTime: 3,
      traitorCount: 1,
      heroCount: 3,
      citizenCount: 1,
      gmEnabled: false,
      hostIsGM: false,
      gmFixedRoles: {},
    };
  }
  return {
    cardDrawInterval: Math.round((api.drawIntervalSec ?? 180) / 60),
    bombTimer: Math.round((api.bombDelaySec ?? 300) / 60),
    handLimit: api.handLimit ?? 4,
    fearKingReviveHp: api.fearReviveHp ?? 3,
    chaosKingPersistTime: Math.round((api.trollSurviveSec ?? 180) / 60),
    traitorCount: api.teamCounts?.traitor ?? 1,
    heroCount: api.teamCounts?.hero ?? 3,
    citizenCount: api.teamCounts?.civil ?? 1,
    gmEnabled: api.gmMode?.enabled ?? false,
    hostIsGM: api.gmMode?.hostIsGM ?? false,
    gmFixedRoles: api.gmMode?.fixedRoles ?? {},
  };
}

function toApiSettings(ui: RoomSettings): ApiRoomSettings {
  return {
    drawIntervalSec: ui.cardDrawInterval * 60,
    bombDelaySec: ui.bombTimer * 60,
    handLimit: ui.handLimit,
    fearReviveHp: ui.fearKingReviveHp,
    trollSurviveSec: ui.chaosKingPersistTime * 60,
    teamCounts: {
      traitor: ui.traitorCount,
      hero: ui.heroCount,
      civil: ui.citizenCount,
    },
    gmMode: {
      enabled: ui.gmEnabled,
      hostIsGM: ui.hostIsGM,
      fixedRoles: ui.gmFixedRoles,
    },
  };
}

const GM_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "mawang_fear", label: "공포의 마왕" },
  { value: "mawang_troll", label: "분탕의 마왕" },
  { value: "aide", label: "참모" },
  { value: "fallen", label: "타락자" },
  { value: "parryman", label: "패링맨" },
  { value: "slayer", label: "슬레이어" },
  { value: "sage", label: "현자" },
  { value: "healer", label: "힐러" },
  { value: "weakling", label: "약골" },
  { value: "coward", label: "겁쟁이" },
  { value: "madman", label: "정신병자" },
  { value: "experiment_host", label: "실험체" },
];

