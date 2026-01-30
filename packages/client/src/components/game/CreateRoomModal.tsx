import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiCreateRoom } from "@/api/rest";

interface CreateRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRoomModal({ open, onOpenChange }: CreateRoomModalProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("마왕 잡으러 갈 사람!");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");

  const canCreate = nickname.trim().length > 0 && title.trim().length > 0;

  const handleCreate = async () => {
    if (!canCreate) return;

    try {
      const res = await apiCreateRoom({
        nickname: nickname.trim(),
        roomTitle: title.trim(),
        password: password.trim() ? password.trim() : null,
      });
      onOpenChange(false);
      navigate(`/room/${res.room.roomId}/lobby`);
    } catch (err) {
      console.error("failed to create room", err);
      // TODO: 에러 토스트/모달 연동
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/60 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gradient-gold">
            새 방 만들기
          </DialogTitle>
          <DialogDescription className="sr-only">
            방 제목, 닉네임, 비밀번호를 입력하고 새 게임 방을 만드는 대화상자입니다.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="room-title">방 제목</Label>
            <Input
              id="room-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={24}
              placeholder="방 제목을 입력하세요"
              className="bg-muted/40 border-border/60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nickname">닉네임</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={12}
              placeholder="닉네임을 입력하세요"
              className="bg-muted/40 border-border/60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center justify-between">
              <span>비밀번호 (선택)</span>
              <span className="text-[11px] text-muted-foreground">
                비워두면 누구나 입장 가능
              </span>
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 설정할 수 있어요"
              className="bg-muted/40 border-border/60"
            />
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="submit"
              variant="gold"
              className="flex-1"
              disabled={!canCreate}
            >
              만들기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

