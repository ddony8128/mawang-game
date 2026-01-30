import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Skull, Shield } from "lucide-react";
import type { UiTeam } from "@/types/game-ui";

interface RevealPlayer {
  id: string;
  nickname: string;
  isDead: boolean;
  roleName: string;
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
      <DialogContent className="bg-card border-border/70 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            최종 역할 공개
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto text-sm">
          {players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                p.isWinner ? "bg-good/10 border border-good/40" : ""
              }`}
            >
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
                  <div className="text-[11px] text-muted-foreground">
                    {p.roleName} • {renderTeamText(p.team)}
                  </div>
                </div>
              </div>
              {p.isWinner && (
                <span className="text-xs text-good font-semibold">
                  승리
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-center">
          <Button variant="gold" size="sm" onClick={onConfirm}>
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

