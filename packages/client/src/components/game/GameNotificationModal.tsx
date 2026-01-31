import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bomb, Beer, Swords, Search, Skull, Heart, ArrowRightLeft } from "lucide-react";

export type NotificationIconType =
  | "sword"
  | "bomb"
  | "beer"
  | "intimidate"
  | "magnifier"
  | "transfer"
  | "death"
  | "reveal"
  | "heal";

export interface GameNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  iconType?: NotificationIconType;
}

interface GameNotificationModalProps {
  notification: GameNotification | null;
  onConfirm: () => void;
}

export default function GameNotificationModal({
  notification,
  onConfirm,
}: GameNotificationModalProps) {
  const open = !!notification;

  const renderIcon = () => {
    if (!notification?.iconType) return null;
    // 아이콘 크기 기본값보다 3배 키움
    const base = "w-24 h-24";
    switch (notification.iconType) {
      case "sword":
        return <Swords className={`${base} text-card-sword`} />;
      case "bomb":
        return <Bomb className={`${base} text-card-bomb`} />;
      case "beer":
        return <Beer className={`${base} text-card-beer`} />;
      case "magnifier":
        return <Search className={`${base} text-card-magnifier`} />;
      case "transfer":
        return <ArrowRightLeft className={`${base} text-card-magnifier`} />;
      case "death":
        return <Skull className={`${base} text-destructive`} />;
      case "heal":
        return <Heart className={`${base} text-primary fill-primary`} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      {/* 모달 전체 크기를 약 2배 키우고 패딩도 여유 있게 조정 */}
      <DialogContent className="bg-card border-primary/50 max-w-lg px-8 py-6">
        <DialogHeader className="items-center">
          {renderIcon()}
          {/* 제목 글씨 한 단계 키움 */}
          <DialogTitle className="mt-4 text-center text-xl">
            {notification?.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            게임 내에서 발생한 이벤트를 알리는 대화상자입니다.
          </DialogDescription>
        </DialogHeader>
        {/* 본문 글씨 한 단계 키움 */}
        <p className="mt-2 text-base text-muted-foreground text-center">
          {notification?.message}
        </p>
        <div className="mt-6 flex justify-center">
          <Button size="lg" variant="gold" onClick={onConfirm}>
            확인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

