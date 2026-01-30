import { useNavigate, useParams } from "react-router-dom";
import { Trophy, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ResultPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full rounded-2xl p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
            <Trophy className="w-9 h-9 text-accent" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-gradient-gold">
            이번 판이 종료되었습니다
          </h1>
          <p className="text-sm text-muted-foreground">
            자세한 결과(GameEndState, 역할 공개 등)는
            <br />
            추후 WebSocket 종료 패킷 연동 시 이 화면에서 표시됩니다.
          </p>
          {roomId && (
            <p className="text-xs text-muted-foreground/70">
              roomId: <span className="font-mono">{roomId}</span>
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Button
            variant="gold"
            className="w-full"
            onClick={() => navigate("/rooms")}
          >
            대기 중인 다른 방 보기
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/")}
          >
            <Home className="w-4 h-4 mr-2" />
            메인으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  );
}

