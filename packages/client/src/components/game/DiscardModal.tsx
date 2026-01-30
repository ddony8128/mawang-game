import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UiCard } from "@/types/game-ui";

interface DiscardModalProps {
  open: boolean;
  cards: UiCard[];
  handLimit: number;
  onDiscard: (cardId: string) => void;
}

export default function DiscardModal({
  open,
  cards,
  handLimit,
  onDiscard,
}: DiscardModalProps) {
  const excess = Math.max(0, cards.length - handLimit);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="bg-card border-border/60 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            카드를 버려주세요
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">
          손패 제한 {handLimit}장을 초과했습니다.{" "}
          <span className="font-semibold text-primary">
            {excess}장
          </span>
          의 카드를 버려야 합니다.
        </p>
        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onDiscard(card.id)}
              className="glass-card rounded-lg border border-destructive/40 hover:border-destructive/80 px-3 py-2 text-left text-xs transition-all"
            >
              <div className="font-semibold mb-1 truncate">
                {card.name}
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-3">
                {card.description}
              </p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          버릴 카드를 클릭하면 즉시 버려집니다.
        </p>
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" disabled>
            선택 대기 중...
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

