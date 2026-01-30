import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import imgVictory from "@/assets/result/승리.jpg";
import imgDefeat from "@/assets/result/패배.jpg";

interface GameResult {
  isVictory: boolean;
  winningTeam: "good" | "evil";
  reason: string;
}

interface GameResultModalProps {
  open: boolean;
  result: GameResult | null;
  onConfirm: () => void;
}

export default function GameResultModal({
  open,
  result,
  onConfirm,
}: GameResultModalProps) {
  if (!result) return null;

  const imageUrl = result.isVictory ? imgVictory : imgDefeat;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="bg-card border-border/70 max-w-xs text-center">
        <DialogHeader>
          <div className="flex flex-col items-center gap-2">
            <img
              src={imageUrl}
              alt={result.isVictory ? "승리" : "패배"}
              className="w-28 h-28 object-contain mx-auto drop-shadow-lg"
            />
            <DialogTitle className="text-2xl font-black text-gradient-gold">
              {result.isVictory ? "승리!" : "패배..."}
            </DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {result.winningTeam === "good" ? "선 팀" : "악 팀"}의 승리
          </p>
          <p className="text-sm">{result.reason}</p>
        </div>
        <div className="mt-4 flex justify-center">
          <Button variant="gold" size="sm" onClick={onConfirm}>
            최종 결과 보기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

