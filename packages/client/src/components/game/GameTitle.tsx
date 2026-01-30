import { Crown, Skull } from "lucide-react";

export function GameTitle() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex items-center gap-2">
        <Crown className="w-7 h-7 text-accent animate-float" />
        <h1 className="text-3xl font-black tracking-tight text-gradient-gold">
          마(피아)왕 게임
        </h1>
        <Skull className="w-7 h-7 text-evil animate-float" />
      </div>
      <p className="text-sm text-muted-foreground max-w-xs">
        마왕을 숨긴 채 서로를 속이고 의심하는
        <br />
        실시간 소셜 추리 카드 게임
      </p>
    </div>
  );
}

