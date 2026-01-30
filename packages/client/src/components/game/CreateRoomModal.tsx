import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const handleCreate = () => {
    if (!canCreate) return;

    // TODO: 실제 방 생성 REST 연동 후 roomId 로비로 이동
    localStorage.setItem(
      "mawang_player",
      JSON.stringify({ nickname: nickname.trim() })
    );
    onOpenChange(false);
    navigate("/rooms");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/60 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gradient-gold">
            새 방 만들기
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 설정할 수 있어요"
              className="bg-muted/40 border-border/60"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            variant="gold"
            className="flex-1"
            onClick={handleCreate}
            disabled={!canCreate}
          >
            만들기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

