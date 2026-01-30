import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UiGameEvent } from "@/types/game-ui";
import { Book, Scroll, StickyNote } from "lucide-react";

type DrawerTab = "rules" | "log" | "memo";

interface GameDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab: DrawerTab;
  eventLog: UiGameEvent[];
  roomId: string;
  playerId: string;
}

export default function GameDrawer({
  open,
  onOpenChange,
  defaultTab,
  eventLog,
  roomId,
  playerId,
}: GameDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>(defaultTab);

  useEffect(() => {
    if (open) {
      setTab(defaultTab);
    }
  }, [open, defaultTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-x-0 bottom-0 top-auto translate-y-0 max-w-none rounded-t-2xl border-border/70 bg-card/98 p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm text-muted-foreground">
            방 ID: {roomId} • 플레이어: {playerId}
          </DialogTitle>
        </DialogHeader>

        <div className="border-b border-border/40 px-4 pb-2 flex gap-2">
          <DrawerTabButton
            icon={<Book className="w-4 h-4" />}
            active={tab === "rules"}
            onClick={() => setTab("rules")}
          >
            규칙
          </DrawerTabButton>
          <DrawerTabButton
            icon={<Scroll className="w-4 h-4" />}
            active={tab === "log"}
            onClick={() => setTab("log")}
          >
            로그
          </DrawerTabButton>
          <DrawerTabButton
            icon={<StickyNote className="w-4 h-4" />}
            active={tab === "memo"}
            onClick={() => setTab("memo")}
          >
            메모
          </DrawerTabButton>
        </div>

        <ScrollArea className="max-h-[55vh] px-4 pb-4">
          {tab === "rules" && <RulesContent />}
          {tab === "log" && <LogContent eventLog={eventLog} />}
          {tab === "memo" && <MemoContent />}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function DrawerTabButton({
  icon,
  active,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant={active ? "gold" : "ghost"}
      className="flex-1"
      onClick={onClick}
    >
      {icon}
      <span className="ml-1 text-sm">{children}</span>
    </Button>
  );
}

function RulesContent() {
  return (
    <div className="space-y-3 text-sm pt-2">
      <p className="text-muted-foreground">
        자세한 규칙은 &quot;게임하는 법&quot; 화면을 참고하세요. 인게임에서는
        요약만 제공합니다.
      </p>
      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
        <li>마왕이 죽으면 선 팀(용사 + 시민) 승리</li>
        <li>모든 용사가 죽으면 악 팀(마왕 + 배신자) 승리</li>
        <li>카드는 3분마다 1장씩 자동 드로우</li>
        <li>손패는 최대 4장, 초과 시 즉시 버리기</li>
      </ul>
    </div>
  );
}

function LogContent({ eventLog }: { eventLog: UiGameEvent[] }) {
  if (!eventLog.length) {
    return (
      <p className="text-sm text-muted-foreground pt-2">
        아직 기록된 로그가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2 pt-2 text-sm">
      {eventLog.map((e) => (
        <div
          key={e.id}
          className="text-xs text-muted-foreground border-b border-border/20 pb-1 last:border-0"
        >
          <span className="font-mono mr-2 opacity-70">
            {new Date(e.timestamp).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          <span>{e.message}</span>
        </div>
      ))}
    </div>
  );
}

function MemoContent() {
  return (
    <div className="space-y-2 pt-2 text-sm text-muted-foreground">
      <p>메모 기능은 추후 구현 예정입니다.</p>
      <p>현재는 종이/디스코드 등 외부 메모를 사용해 주세요.</p>
    </div>
  );
}

