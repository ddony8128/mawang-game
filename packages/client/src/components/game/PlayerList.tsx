import { Bomb, Skull } from "lucide-react";
import type { UiKnownInfo, UiPlayer } from "@/types/game-ui";

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

interface PlayerListProps {
  players: UiPlayer[];
  myPlayerId: string;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
  knownInfo: UiKnownInfo;
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
          const knownRoleKey = info?.roleKey;
          const selfRoleKey = isMe && p.role ? p.role.id : undefined;
          const roleIconKey = knownRoleKey ?? selfRoleKey;

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
                    {roleIconKey && ROLE_ICON_URL[roleIconKey] && (
                      <img
                        src={ROLE_ICON_URL[roleIconKey]}
                        alt=""
                        className="w-4 h-4 rounded-sm object-contain mr-0.5"
                      />
                    )}
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
                  <div className="flex flex-col mt-1 gap-0.5 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <HpDots hp={p.hp} maxHp={p.maxHp} />
                      {info?.team && (
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
                    {info?.roleName && (
                      <div className="text-[11px] text-foreground/80">
                        역할: <span className="font-medium">{info.roleName}</span>
                      </div>
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

