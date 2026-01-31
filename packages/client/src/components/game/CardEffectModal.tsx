import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UiCard, UiPlayer } from "@/types/game-ui";

type EffectResultType =
  | "damage"
  | "heal"
  | "bomb_placed"
  | "info_team"
  | "info_role"
  | "transfer";

interface EffectResult {
  type: EffectResultType;
  value?: number;
  team?: "good" | "evil";
  roleName?: string;
}

interface CardEffectModalProps {
  open: boolean;
  card: UiCard | null;
  targetPlayer: UiPlayer | null;
  effectResult?: EffectResult;
  onConfirm: () => void;
}

export default function CardEffectModal({
  open,
  card,
  targetPlayer,
  effectResult,
  onConfirm,
}: CardEffectModalProps) {
  if (!card) return null;

  const description = getEffectDescription(
    card,
    targetPlayer?.nickname ?? "알 수 없음",
    effectResult
  );

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="bg-card border-primary/50 max-w-lg px-8 py-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            카드 효과
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-center">
          <p className="font-semibold text-base">{card.name}</p>
          <p className="text-base text-muted-foreground whitespace-pre-line">
            {description}
          </p>
        </div>
        <div className="mt-6 flex justify-center">
          <Button size="lg" variant="gold" onClick={onConfirm}>
            확인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getEffectDescription(
  card: UiCard,
  targetName: string,
  effect?: EffectResult
): string {
  if (!effect) return card.description;

  switch (effect.type) {
    case "damage":
      return `${targetName}에게 ${effect.value ?? 1} 피해를 입혔습니다.`;
    case "heal":
      return `${targetName}의 체력을 ${effect.value ?? 1} 회복했습니다.`;
    case "bomb_placed":
      return `${targetName}에게 폭탄을 설치했습니다. 잠시 후 폭발합니다.`;
    case "info_team":
      return `${targetName}는 ${
        effect.team === "evil" ? "악 팀" : "선 팀"
      }입니다.`;
    case "info_role":
      return `${targetName}의 역할은 ${
        effect.roleName ?? "알 수 없음"
      }입니다.`;
    case "transfer":
      return `${targetName}에게 카드를 넘겼습니다.`;
    default:
      return card.description;
  }
}

