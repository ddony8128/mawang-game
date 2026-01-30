import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DoorOpen, Plus, HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GameTitle } from "@/components/game/GameTitle";
import { CreateRoomModal } from "@/components/game/CreateRoomModal";

export function MainPage() {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col items-center justify-center p-6">
      {/* 배경 장식 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-12 w-full max-w-sm">
        <GameTitle />

        <div className="w-full space-y-4">
          <Button
            variant="menu"
            onClick={() => navigate("/rooms")}
            className="animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            <DoorOpen className="w-5 h-5" />
            입장하기
          </Button>

          <Button
            variant="menu"
            onClick={() => setShowCreateModal(true)}
            className="animate-slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            <Plus className="w-5 h-5" />
            방 만들기
          </Button>

          <Button
            variant="menu"
            onClick={() => navigate("/how-to-play")}
            className="animate-slide-up"
            style={{ animationDelay: "0.3s" }}
          >
            <HelpCircle className="w-5 h-5" />
            게임하는 법
          </Button>
        </div>

        <p className="text-muted-foreground text-xs text-center">
          6~10명 • 실시간 플레이 • 20~30분
        </p>
      </div>

      <CreateRoomModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </div>
  );
}

