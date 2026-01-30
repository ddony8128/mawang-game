import { Heart, Timer, Shield } from "lucide-react";
import type { UiPlayer } from "@/types/game-ui";

interface GameTopBarProps {
  player: UiPlayer;
  nextCardDrawInSeconds: number;
}

function GameTopBar({ player, nextCardDrawInSeconds }: GameTopBarProps) {
  const minutes = Math.floor(nextCardDrawInSeconds / 60);
  const seconds = nextCardDrawInSeconds % 60;

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border/50 px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">나</span>
            <span className="font-semibold flex items-center gap-1">
              {player.nickname}
              {player.role && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
                  {player.role.name}
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: player.maxHp }).map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${
                  i < player.hp
                    ? "text-primary fill-primary"
                    : "text-muted-foreground"
                }`}
              />
            ))}
          </div>
          {player.status.isInvincible && (
            <div className="flex items-center gap-1 text-xs text-hero bg-hero/10 border border-hero/40 rounded-full px-2 py-0.5">
              <Shield className="w-3 h-3" />
              무적
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border/60">
            <Timer className="w-4 h-4" />
            <span>다음 카드까지</span>
            <span className="font-mono">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export { GameTopBar };
export default GameTopBar;

