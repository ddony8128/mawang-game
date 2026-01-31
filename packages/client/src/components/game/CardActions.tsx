import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { UiCard } from "@/types/game-ui";

interface CardActionsProps {
  selectedCard: UiCard;
  selectedPlayerName: string | null;
  canUse: boolean;
  canTransfer: boolean;
  selectedMagnifierIds?: string[];
  onUseSingleCard: () => void;
  onUseMagnifier: (
    ids: string[],
    mode: "magnifier2" | "magnifier3",
  ) => void;
  onTransferCard: () => void;
  onCancel: () => void;
}

export default function CardActions({
  selectedCard,
  selectedPlayerName,
  canUse,
  canTransfer,
  selectedMagnifierIds,
  onUseSingleCard,
  onUseMagnifier,
  onTransferCard,
  onCancel,
}: CardActionsProps) {
  const [error, setError] = useState(false);

  const handleUseClick = () => {
    if (selectedCard.type !== "magnifier") {
      onUseSingleCard();
      return;
    }

    // 돋보기는 손패에서 현재 선택된 돋보기들을 기준으로 2장 또는 3장을 사용한다.
    const ids =
      selectedMagnifierIds && selectedMagnifierIds.length > 0
        ? selectedMagnifierIds
        : [selectedCard.id];

    // 현재 설계상 CardHand 에서 돋보기 다중 선택을 관리하므로,
    // 여기서는 최소 2/3장 여부만 검증해서 잘못된 경우 빨간색 연출만 한다.
    if (ids.length === 2) {
      onUseMagnifier(ids, "magnifier2");
      setError(false);
      return;
    }
    if (ids.length === 3) {
      onUseMagnifier(ids, "magnifier3");
      setError(false);
      return;
    }

    // 잘못된 조합(1장 등): 빨간색 연출
    setError(true);
    setTimeout(() => setError(false), 500);
  };

  return (
    <div
      className={`px-4 pb-3 pt-2 border-t bg-card/95 ${
        error ? "border-destructive" : "border-border/30"
      }`}
    >
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
            onClick={handleUseClick}
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

