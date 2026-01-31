import { Heart, Timer, Shield, Bomb, AlertTriangle, Circle, Skull } from "lucide-react";
import type { UiPlayer } from "@/types/game-ui";

interface GameTopBarProps {
  player: UiPlayer;
  nextCardDrawInSeconds: number;
  connectionStatus?: "connecting" | "connected" | "reconnecting" | "error";
}

function GameTopBar({
  player,
  nextCardDrawInSeconds,
  connectionStatus = "connected",
}: GameTopBarProps) {
  const minutes = Math.floor(nextCardDrawInSeconds / 60);
  const seconds = nextCardDrawInSeconds % 60;
  const bombSeconds = player.status.hasBomb?.remainingSeconds ?? 0;
  const invincibleSeconds = player.status.isInvincible?.remainingSeconds ?? 0;
  const intimidatedSeconds = player.status.isIntimidated?.remainingSeconds ?? 0;
  const stubbornSeconds = player.status.trollStubborn?.remainingSeconds ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border/50 px-4 py-3">
      <div className="max-w-3xl mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">나</span>
              <span className="font-semibold flex items-center gap-2 text-lg">
                {player.nickname}
                {player.role && (
                  <span className="text-xs px-3 py-1 rounded-full bg-accent/20 text-accent-foreground">
                    {player.role.name}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: player.maxHp }).map((_, i) => (
                <Heart
                  key={i}
                  className={`w-5 h-5 ${
                    i < player.hp
                      ? "text-primary fill-primary"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {player.status.isInvincible && (
              <div className="flex items-center gap-1 text-xs text-hero bg-hero/10 border border-hero/40 rounded-full px-3 py-1">
                <Shield className="w-4 h-4" />
                <span>무적</span>
                <span className="font-mono">
                  {formatCountdown(invincibleSeconds)}
                </span>
              </div>
            )}
            {player.status.isIntimidated && (
              <div className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 border border-destructive/40 rounded-full px-3 py-1">
                <AlertTriangle className="w-4 h-4" />
                <span>겁주기</span>
                <span className="font-mono">
                  {formatCountdown(intimidatedSeconds)}
                </span>
              </div>
            )}
            {player.status.trollStubborn && (
              <div className="flex items-center gap-1 text-xs text-evil bg-evil/10 border border-evil/40 rounded-full px-3 py-1">
                <Skull className="w-4 h-4" />
                <span>집념</span>
                <span className="font-mono">
                  {formatCountdown(stubbornSeconds)}
                </span>
              </div>
            )}
            {player.status.hasBomb && (
              <div className="flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/40 rounded-full px-3 py-1">
                <Bomb className="w-4 h-4" />
                <span>폭탄</span>
                <span className="font-mono">
                  {formatCountdown(bombSeconds)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border/60">
            <Timer className="w-4 h-4" />
            <span>다음 카드까지</span>
            <span className="font-mono">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border/60">
            <Circle
              className={`w-3 h-3 ${
                connectionStatus === "connected"
                  ? "text-emerald-500"
                  : connectionStatus === "reconnecting"
                    ? "text-amber-500"
                    : connectionStatus === "connecting"
                      ? "text-sky-400"
                      : "text-destructive"
              }`}
              fill="currentColor"
            />
            <span className="text-[11px]">
              {connectionStatus === "connected" && "연결됨"}
              {connectionStatus === "connecting" && "연결 중"}
              {connectionStatus === "reconnecting" && "재연결 중"}
              {connectionStatus === "error" && "연결 오류"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export { GameTopBar };
export default GameTopBar;

function formatCountdown(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

