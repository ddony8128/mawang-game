import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Skull, Shield } from "lucide-react";
import type { UiTeam } from "@/types/game-ui";

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

interface RevealPlayer {
  id: string;
  nickname: string;
  isDead: boolean;
  roleName: string;
  roleKey?: string;
  team: UiTeam;
  isWinner: boolean;
}

interface PlayerRevealModalProps {
  open: boolean;
  players: RevealPlayer[];
  onConfirm: () => void;
}

export default function PlayerRevealModal({
  open,
  players,
  onConfirm,
}: PlayerRevealModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="bg-card border-primary/50 max-w-lg px-8 py-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            최종 역할 공개
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto text-base">
          {players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                p.isWinner ? "bg-good/10 border border-good/40" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                {p.roleKey && ROLE_ICON_URL[p.roleKey] && (
                  <img
                    src={ROLE_ICON_URL[p.roleKey]}
                    alt={p.roleName}
                    className="w-16 h-16 rounded-md object-contain"
                  />
                )}
                <div className="flex items-center gap-2">
                  {renderTeamIcon(p.team)}
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">{p.nickname}</span>
                      {p.isDead && (
                        <span className="text-[11px] text-destructive">
                          (사망)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.roleName} • {renderTeamText(p.team)}
                    </div>
                  </div>
                </div>
              </div>
              {p.isWinner && (
                <span className="text-xs text-good font-semibold">승리</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-center">
          <Button variant="gold" size="lg" onClick={onConfirm}>
            로비로 돌아가기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderTeamIcon(team: UiTeam) {
  switch (team) {
    case "good":
      return <Shield className="w-4 h-4 text-good" />;
    case "evil":
      return <Skull className="w-4 h-4 text-evil" />;
    case "citizen":
    default:
      return <Crown className="w-4 h-4 text-citizen" />;
  }
}

function renderTeamText(team: UiTeam) {
  switch (team) {
    case "good":
      return "선 팀";
    case "evil":
      return "악 팀";
    case "citizen":
    default:
      return "시민";
  }
}

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


