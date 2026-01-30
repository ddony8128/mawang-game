import { Crown, Skull } from "lucide-react";
import logoImg from "@/assets/logo.png";

export function GameTitle() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <img
        src={logoImg}
        alt="마(피아)왕 게임 로고"
        className="w-32 h-32 object-contain drop-shadow-lg"
      />
      <div className="flex flex-col items-center gap-2">
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
    </div>
  );
}

