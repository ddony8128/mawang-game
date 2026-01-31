import { Bomb, Skull, Shield, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <div className="max-w-3xl mx-auto w-full px-4 pt-4 pb-6">
      {/* 인게임 하단 고정 영역(능력/카드 바)을 가리지 않고 플레이어를 충분히 볼 수 있도록
          뷰포트 기준 최대 높이를 잡고 내부를 스크롤 가능하게 만든다. */}
      <ScrollArea className="max-h-[calc(100vh-220px)] pr-2">
        <div className="grid grid-cols-2 gap-3 pb-4">
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
                className={`glass-card rounded-xl px-3 py-3 text-left border ${borderColor} ${bgColor} transition-all hover:border-primary/60 hover:shadow-glow-purple`}
              >
                <div className="flex items-center gap-3">
                  {roleIconKey && ROLE_ICON_URL[roleIconKey] && (
                    <img
                      src={ROLE_ICON_URL[roleIconKey]}
                      alt=""
                      className="w-16 h-16 rounded-md object-contain border border-border/60 bg-background/40 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base truncate">
                        {p.nickname}
                        {isMe && (
                          <span className="text-primary text-sm ml-1">
                            (나)
                          </span>
                        )}
                      </span>
                      {p.isDead && (
                        <Skull className="w-4 h-4 text-destructive shrink-0" />
                      )}
                    </div>
                    <div className="flex flex-col mt-2 gap-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <HpHearts hp={p.hp} maxHp={p.maxHp} />
                        {info?.team && (
                          <span
                            className={
                              info.team === "evil"
                                ? "text-evil font-semibold"
                                : "text-good font-semibold"
                            }
                          >
                            {info.team === "evil" ? "악" : "선"} 확정
                          </span>
                        )}
                      </div>
                      {info?.roleName && (
                        <div className="text-xs text-foreground/80">
                          역할: <span className="font-medium">{info.roleName}</span>
                        </div>
                      )}
                      {p.status.bombs &&
                        p.status.bombs.map((bomb) => (
                          <div
                            key={bomb.id}
                            className="flex items-center gap-1 text-xs text-destructive mt-1"
                          >
                            <Bomb className="w-4 h-4" />
                            <span>폭탄</span>
                            <span className="font-mono">
                              {formatCountdown(bomb.remainingSeconds)}
                            </span>
                          </div>
                        ))}
                      {p.status.isInvincible && (
                        <div className="flex items-center gap-1 text-xs text-hero mt-1">
                          <Shield className="w-4 h-4" />
                          <span>무적</span>
                          <span className="font-mono">
                            {formatCountdown(p.status.isInvincible.remainingSeconds)}
                          </span>
                        </div>
                      )}
                      {p.status.isIntimidated && (
                        <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                          <AlertTriangle className="w-4 h-4" />
                          <span>겁주기</span>
                          <span className="font-mono">
                            {formatCountdown(p.status.isIntimidated.remainingSeconds)}
                          </span>
                        </div>
                      )}
                      {p.status.trollStubborn && (
                        <div className="flex items-center gap-1 text-xs text-evil mt-1">
                          <Skull className="w-4 h-4" />
                          <span>집념</span>
                          <span className="font-mono">
                            {formatCountdown(p.status.trollStubborn.remainingSeconds)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function HpHearts({ hp, maxHp }: { hp: number; maxHp: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maxHp }).map((_, i) => (
        <span key={i} className="text-lg leading-none">
          {i < hp ? "❤️" : "🤍"}
        </span>
      ))}
    </div>
  );
}

function formatCountdown(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

