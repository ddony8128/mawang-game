import { Button } from "@/components/ui/button";
import type { UiCard } from "@/types/game-ui";

interface CardActionsProps {
  selectedCard: UiCard;
  selectedPlayerName: string | null;
  canUse: boolean;
  canTransfer: boolean;
  onUseCard: () => void;
  onTransferCard: () => void;
  onCancel: () => void;
}

export default function CardActions({
  selectedCard,
  selectedPlayerName,
  canUse,
  canTransfer,
  onUseCard,
  onTransferCard,
  onCancel,
}: CardActionsProps) {
  return (
    <div className="px-4 pb-3 pt-2 border-t border-border/30 bg-card/95">
      <div className="max-w-3xl mx-auto space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex flex-col">
            <span className="text-muted-foreground">선택한 카드</span>
            <span className="font-semibold">{selectedCard.name}</span>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {selectedPlayerName ? (
              <>
                대상: <span className="font-medium">{selectedPlayerName}</span>
              </>
            ) : selectedCard.type === "beer" ? (
              <>자신에게 사용</>
            ) : (
              <>대상을 선택하세요</>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="gold"
            disabled={!canUse}
            onClick={onUseCard}
          >
            사용
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canTransfer}
            onClick={onTransferCard}
          >
            양도
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}

