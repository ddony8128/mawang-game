import { Bomb, Skull } from "lucide-react";
import type { UiPlayer } from "@/types/game-ui";

interface PlayerListProps {
  players: UiPlayer[];
  myPlayerId: string;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
  knownInfo: Record<
    string,
    {
      team: "good" | "evil" | "citizen";
    }
  >;
}

export default function PlayerList({
  players,
  myPlayerId,
  selectedPlayerId,
  onSelectPlayer,
  knownInfo,
}: PlayerListProps) {
  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {players.map((p) => {
          const isMe = p.id === myPlayerId;
          const isSelected = p.id === selectedPlayerId;
          const info = knownInfo[p.id];

          const borderColor = isSelected
            ? "border-primary"
            : isMe
            ? "border-accent"
            : p.isDead
            ? "border-destructive/50"
            : "border-border/60";

          const bgColor = p.isDead ? "bg-muted/40" : "bg-card/70";

          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                onSelectPlayer(isSelected ? null : p.id)
              }
              className={`glass-card rounded-lg px-3 py-2 text-left border ${borderColor} ${bgColor} transition-all hover:border-primary/60 hover:shadow-glow-purple`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-sm truncate">
                      {p.nickname}
                      {isMe && (
                        <span className="text-primary text-xs ml-1">
                          (나)
                        </span>
                      )}
                    </span>
                    {p.isDead && (
                      <Skull className="w-3 h-3 text-destructive shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                    <HpDots hp={p.hp} maxHp={p.maxHp} />
                    {info && (
                      <span
                        className={
                          info.team === "evil"
                            ? "text-evil ml-1"
                            : "text-good ml-1"
                        }
                      >
                        {info.team === "evil" ? "악" : "선"} 확정
                      </span>
                    )}
                  </div>
                </div>

                {p.status.hasBomb && (
                  <div className="flex flex-col items-end text-[10px] text-destructive">
                    <div className="flex items-center gap-1">
                      <Bomb className="w-3 h-3" />
                      <span>폭탄</span>
                    </div>
                    <span className="opacity-80">
                      {Math.ceil(p.status.hasBomb.remainingSeconds / 60)}분 후
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HpDots({ hp, maxHp }: { hp: number; maxHp: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maxHp }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-3 rounded-full ${
            i < hp ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

