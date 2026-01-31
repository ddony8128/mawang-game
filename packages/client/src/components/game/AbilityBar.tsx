import { Button } from "@/components/ui/button";
import type { UiAbility } from "@/types/game-ui";

interface AbilityBarProps {
  abilities: UiAbility[];
  disabled?: boolean;
  selectedAbilityId: string | null;
  onSelectAbility: (id: string) => void;
}

export default function AbilityBar({
  abilities,
  disabled,
  selectedAbilityId,
  onSelectAbility,
}: AbilityBarProps) {
  if (!abilities.length) return null;

  const now = Date.now();

  return (
    <div className="px-4 py-2 border-t border-border/40 bg-card/95">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">직업 능력</span>
          {disabled && (
            <span className="text-[11px] text-destructive">
              겁주기 상태로 능력을 사용할 수 없습니다
            </span>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {abilities.map((ability) => {
            const readyAt = ability.lastUsedAt
              ? ability.lastUsedAt + ability.cooldown * 1000
              : 0;
            const remainingMs = readyAt - now;
            const isOnCooldown = remainingMs > 0;
            const remainingSec = Math.ceil(remainingMs / 1000);

            return (
              <Button
                key={ability.id}
                size="sm"
                variant={
                  selectedAbilityId === ability.id ? "gold" : "secondary"
                }
                disabled={disabled || isOnCooldown || ability.used}
                onClick={() => onSelectAbility(ability.id)}
                className="shrink-0 min-w-[140px] justify-start"
              >
                <div className="flex flex-col items-start">
                  <span className="text-xs font-semibold">
                    {ability.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground line-clamp-2">
                    {ability.used
                      ? "이미 사용한 일회성 능력입니다"
                      : isOnCooldown
                        ? `쿨타임 ${remainingSec}초`
                        : ability.description}
                  </span>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

