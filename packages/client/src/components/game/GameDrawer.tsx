import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemoStore } from "@/stores/memoStore";
import type { UiGameEvent, UiGameSettings } from "@/types/game-ui";
import { Book, Scroll, StickyNote } from "lucide-react";

type DrawerTab = "rules" | "log" | "memo";

interface GameDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab: DrawerTab;
  eventLog: UiGameEvent[];
  roomId: string;
  settings: UiGameSettings;
}

export default function GameDrawer({
  open,
  onOpenChange,
  defaultTab,
  eventLog,
  roomId,
  settings,
}: GameDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>(defaultTab);

  useEffect(() => {
    if (open) {
      setTab(defaultTab);
    }
  }, [open, defaultTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-x-0 bottom-0 top-auto translate-x-0 translate-y-0 max-w-none rounded-t-2xl border-border/70 bg-card/98 p-0 flex flex-col h-[60vh]">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm text-muted-foreground">
            인게임 정보
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

        <ScrollArea className="flex-1 px-4 pb-4">
          {tab === "rules" && <RulesContent settings={settings} />}
          {tab === "log" && <LogContent eventLog={eventLog} />}
          {tab === "memo" && <MemoContent memoKey={roomId} />}
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

function RulesContent({ settings }: { settings: UiGameSettings }) {
  const traitorCount = settings.teamCounts?.traitor ?? 1;
  const heroCount = settings.teamCounts?.hero ?? 3;
  const civilCount = settings.teamCounts?.civil ?? 1;

  const drawMinutes = Math.round(settings.cardDrawInterval / 60);
  const bombMinutes = Math.round(settings.bombTimer / 60);
  const chaosMinutes = Math.round(settings.chaosKingPersistTime / 60);

  return (
    <div className="space-y-4 text-sm pt-2">
      <div className="space-y-1 text-muted-foreground">
        <p>이 방에서 진행 중인 게임 규칙 요약입니다.</p>
        <p className="text-[11px]">
          자세한 설명은 &quot;게임하는 법&quot; 화면에서 확인할 수 있습니다.
        </p>
      </div>

      {/* 팀 구성 / 인원 */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-muted-foreground">
          팀 구성
        </h3>
        <ul className="list-none space-y-0.5 text-muted-foreground">
          <li>• 배신자 {traitorCount}명</li>
          <li>• 용사 {heroCount}명</li>
          <li>• 시민 {civilCount}명</li>
        </ul>
      </div>

      {/* 기본 카드 / 타이머 규칙 */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-muted-foreground">
          카드 / 타이머
        </h3>
        <ul className="list-none space-y-0.5 text-muted-foreground">
          <li>• 카드 드로우: {drawMinutes}분마다 카드 1장 자동 획득</li>
          <li>• 폭탄 시한: 설치 후 약 {bombMinutes}분 뒤 2 데미지</li>
          <li>• 손패 제한: 최대 {settings.handLimit}장 (초과 시 버리기 필요)</li>
          <li>
            • 공포의 마왕 부활 HP: 사망 시 생명력 {settings.fearKingReviveHp}으로
            부활
          </li>
          <li>
            • 분탕의 마왕 집념: 사망 후 약 {chaosMinutes}분 동안 실제로 죽지 않음
          </li>
        </ul>
      </div>

      {/* 카드 효과 요약 */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-muted-foreground">
          카드 사용 규칙
        </h3>
        <ul className="list-none space-y-0.5 text-muted-foreground">
          <li>• 돋보기 2장: 대상 1명의 선/악 팀 확인</li>
          <li>• 돋보기 3장: 대상 1명의 정확한 역할 확인</li>
          <li>• 칼: 대상 1명에게 1 데미지</li>
          <li>• 폭탄: 대상 지정 후 시한이 끝나면 2 데미지</li>
          <li>• 맥주: 자신 생명력 1 회복</li>
        </ul>
      </div>

      {/* 역할 능력 요약 */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground">
          역할 능력 요약
        </h3>

        <div className="space-y-1 text-muted-foreground">
          <p className="font-semibold">악 팀 – 마왕 / 배신자</p>
          <ul className="list-none space-y-0.5">
            <li>
              • 공포의 마왕: 공포의 재림(1회, 사망 시 생명력 3으로 부활하며
              정체 전체 공개), 겁주기(쿨타임 3분, 대상 1명 2분간 행동 불가)
            </li>
            <li>
              • 분탕의 마왕: 분탕의 집념(1회, 사망해도 {chaosMinutes}
              분 동안 죽지 않고 생존), 가면놀이(1회, 돋보기 대상이 될 때 보일
              자신의 역할을 지정)
            </li>
            <li>
              • 참모: 악의 하수인(게임 시작 시 마왕 정체를 알고 시작), 레이드
              정보(이번 게임에 어떤 용사 역할이 있는지, 전 용사가 있을 경우 어떤
              시민이 있는지도 알고 시작)
            </li>
            <li>
              • 타락자: 악의 하수인(게임 시작 시 마왕 정체를 알고 시작), 술자리
              권유(쿨타임 3분, 대상 1명의 다음 카드 뽑기에서 확정적으로 맥주
              획득)
            </li>
          </ul>
        </div>

        <div className="space-y-1 text-muted-foreground">
          <p className="font-semibold">선 팀 – 용사</p>
          <ul className="list-none space-y-0.5">
            <li>
              • 패링맨: 무적방패(쿨타임 3분, 1분간 받는 피해 모두 무효)
            </li>
            <li>
              • 슬레이어: 짱쎈 필살기(1회, 대상 1명에게 3 데미지, 사용 시 누가
              누구를 공격했는지 전체 공개)
            </li>
            <li>
              • 현자: 예언(돋보기를 뽑을 경우, 돋보기 한 장 추가 획득)
            </li>
            <li>
              • 힐러: 회복 마법(쿨타임 3분, 대상 1명의 생명력 1 회복)
            </li>
          </ul>
        </div>

        <div className="space-y-1 text-muted-foreground">
          <p className="font-semibold">선 팀 – 시민</p>
          <ul className="list-none space-y-0.5">
            <li>
              • 약골: 만성 피로(생명력 2로 시작), 꾀병(HP가 비정상적으로
              표시되며 본인도 실제 생명력을 알 수 없음)
            </li>
            <li>
              • 겁쟁이: 손떨림(카드 사용 시 50% 확률로 사용이 무효 처리)
            </li>
            <li>
              • 정신병자: 망상(자신을 용사라고 인식해 UI 상 용사로 보이지만 실제
              능력은 발동되지 않음)
            </li>
            <li>
              • 실험체: 저주의 숙주(사망 시 악 팀 전원이 카드 2장씩 획득)
            </li>
          </ul>
        </div>
      </div>
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

function MemoContent({ memoKey }: { memoKey: string }) {
  const { byGame, setMemo, clearMemo } = useMemoStore();
  const entry = byGame[memoKey];
  const text = entry?.text ?? "";
  const updatedAt =
    typeof entry?.updatedAtMs === "number"
      ? new Date(entry.updatedAtMs).toLocaleString("ko-KR")
      : null;

  return (
    <div className="space-y-3 pt-2 text-sm text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs">
          이 방에 대한 개인 메모입니다. 이 브라우저에만 저장됩니다.
        </p>
        <button
          type="button"
          onClick={() => clearMemo(memoKey)}
          className="text-[11px] px-2 py-1 rounded border border-border/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          메모 지우기
        </button>
      </div>
      <div>
        <textarea
          value={text}
          onChange={(e) => setMemo(memoKey, e.target.value)}
          placeholder="플레이어 정리, 용의자 목록, 카드 사용 내역 등을 자유롭게 적어두세요."
          className="w-full min-h-[160px] rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {updatedAt && (
          <p className="mt-1 text-[11px] text-muted-foreground text-right">
            마지막 저장: {updatedAt}
          </p>
        )}
      </div>
    </div>
  );
}

