import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bomb, Beer, Swords, Search, Skull, Heart } from "lucide-react";

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
    const base = "w-8 h-8";
    switch (notification.iconType) {
      case "sword":
        return <Swords className={`${base} text-card-sword`} />;
      case "bomb":
        return <Bomb className={`${base} text-card-bomb`} />;
      case "beer":
        return <Beer className={`${base} text-card-beer`} />;
      case "magnifier":
        return <Search className={`${base} text-card-magnifier`} />;
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
      <DialogContent className="bg-card border-primary/50 max-w-xs">
        <DialogHeader className="items-center">
          {renderIcon()}
          <DialogTitle className="mt-2 text-center">
            {notification?.title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground text-center">
          {notification?.message}
        </p>
        <div className="mt-4 flex justify-center">
          <Button size="sm" variant="gold" onClick={onConfirm}>
            확인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

