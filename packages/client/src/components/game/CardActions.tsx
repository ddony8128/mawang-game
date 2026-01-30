import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { UiCard } from "@/types/game-ui";

interface CardActionsProps {
  selectedCard: UiCard;
  selectedPlayerName: string | null;
  canUse: boolean;
  canTransfer: boolean;
  allHandCards: UiCard[];
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
  allHandCards,
  onUseSingleCard,
  onUseMagnifier,
  onTransferCard,
  onCancel,
}: CardActionsProps) {
  const magnifierCards =
    selectedCard.type === "magnifier"
      ? allHandCards.filter((c) => c.type === "magnifier")
      : [];

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState(false);

  const toggleMagnifier = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleUseClick = () => {
    if (selectedCard.type !== "magnifier") {
      onUseSingleCard();
      return;
    }

    if (selectedIds.length === 2) {
      onUseMagnifier(selectedIds, "magnifier2");
      setSelectedIds([]);
      setError(false);
    } else if (selectedIds.length === 3) {
      onUseMagnifier(selectedIds, "magnifier3");
      setSelectedIds([]);
      setError(false);
    } else {
      // 잘못된 조합: 빨갛게 표시하고 선택 초기화
      setError(true);
      setSelectedIds([]);
      setTimeout(() => setError(false), 500);
    }
  };

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

        {selectedCard.type === "magnifier" && magnifierCards.length > 0 && (
          <div
            className={`rounded-md border px-2 py-2 text-[11px] space-y-1 ${
              error ? "border-destructive bg-destructive/5" : "border-border/40"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">
                사용할 돋보기를 선택하세요 (2장 또는 3장)
              </span>
              <span className="font-mono">
                선택: {selectedIds.length}장 / 총 {magnifierCards.length}장
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {magnifierCards.map((card) => {
                const active = selectedIds.includes(card.id);
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => toggleMagnifier(card.id)}
                    className={`px-2 py-1 rounded-full border text-[11px] ${
                      active
                        ? "bg-card-magnifier/20 border-card-magnifier text-card-magnifier-foreground"
                        : "border-border/50 text-muted-foreground hover:border-card-magnifier/60"
                    }`}
                  >
                    돋보기 #{card.id.slice(0, 4)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

