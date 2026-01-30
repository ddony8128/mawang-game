import type { UiCard } from "@/types/game-ui";

interface CardHandProps {
  cards: UiCard[];
  selectedCardId: string | null;
  onSelectCard: (cardId: string | null) => void;
  disabled?: boolean;
}

const cardColors: Record<
  UiCard["type"],
  { bg: string; border: string }
> = {
  magnifier: {
    bg: "bg-card-magnifier/20",
    border: "border-card-magnifier/60",
  },
  sword: {
    bg: "bg-card-sword/20",
    border: "border-card-sword/60",
  },
  bomb: {
    bg: "bg-card-bomb/20",
    border: "border-card-bomb/60",
  },
  beer: {
    bg: "bg-card-beer/20",
    border: "border-card-beer/60",
  },
};

export default function CardHand({
  cards,
  selectedCardId,
  onSelectCard,
  disabled,
}: CardHandProps) {
  return (
    <div className="px-4 pt-2 pb-3 border-t border-border/40 bg-card/95">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">
          내 손패 ({cards.length}장)
        </span>
        {disabled && (
          <span className="text-[11px] text-destructive">
            겁주기 상태로 카드를 사용할 수 없습니다
          </span>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {cards.length === 0 ? (
          <div className="text-xs text-muted-foreground py-3">
            보유한 카드가 없습니다. 곧 카드를 뽑게 될 거예요.
          </div>
        ) : (
          cards.map((card) => {
            const colors = cardColors[card.type];
            const isSelected = card.id === selectedCardId;
            return (
              <button
                key={card.id}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onSelectCard(isSelected ? null : card.id)
                }
                className={`min-w-[96px] max-w-[110px] rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                  colors.bg
                } ${colors.border} ${
                  isSelected
                    ? "ring-2 ring-primary shadow-glow-red"
                    : "hover:border-primary/70"
                }`}
              >
                <div className="font-semibold mb-1 truncate">
                  {card.name}
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-3">
                  {card.description}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

