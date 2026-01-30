import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Lock, Users, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Room {
  id: string;
  title: string;
  hasPassword: boolean;
  currentPlayers: number;
  maxPlayers: number;
  host: string;
}

// Mock data for demonstration
const mockRooms: Room[] = [
  {
    id: "abc123",
    title: "마왕 잡으러 갈 사람!",
    hasPassword: false,
    currentPlayers: 4,
    maxPlayers: 10,
    host: "용사1",
  },
  {
    id: "def456",
    title: "초보만 환영",
    hasPassword: true,
    currentPlayers: 6,
    maxPlayers: 8,
    host: "뉴비왕",
  },
  {
    id: "ghi789",
    title: "고수들의 방",
    hasPassword: false,
    currentPlayers: 8,
    maxPlayers: 8,
    host: "프로게이머",
  },
  {
    id: "jkl012",
    title: "재밌게 해요~",
    hasPassword: false,
    currentPlayers: 3,
    maxPlayers: 10,
    host: "즐겜러",
  },
];

export function RoomsPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>(mockRooms);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      // TODO: 실제 REST /api/rooms 연동
      setRooms([...mockRooms]);
      setIsRefreshing(false);
    }, 500);
  };

  const handleRoomClick = (room: Room) => {
    if (room.currentPlayers >= room.maxPlayers) return;
    setSelectedRoom(room);
    setNickname("");
    setPassword("");
  };

  const handleJoin = () => {
    if (!selectedRoom || !nickname.trim()) return;
    if (selectedRoom.hasPassword && !password.trim()) return;

    localStorage.setItem(
      "mawang_player",
      JSON.stringify({ nickname: nickname.trim() })
    );
    setSelectedRoom(null);
    navigate(`/room/${selectedRoom.id}/lobby`);
  };

  const isJoinValid =
    !!nickname.trim() &&
    (!selectedRoom?.hasPassword || !!password.trim());

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/50 p-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="text-lg font-bold">대기 중인 방</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </header>

      {/* Room List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3 max-w-2xl mx-auto pb-24">
          {rooms.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>대기 중인 방이 없습니다</p>
              <p className="text-sm mt-2">새 방을 만들어보세요!</p>
            </div>
          ) : (
            rooms.map((room, index) => {
              const isFull = room.currentPlayers >= room.maxPlayers;
              return (
                <button
                  key={room.id}
                  onClick={() => handleRoomClick(room)}
                  disabled={isFull}
                  className={`w-full glass-card rounded-xl p-4 text-left transition-all duration-300 animate-fade-in ${
                    isFull
                      ? "opacity-50 cursor-not-allowed border-destructive/30"
                      : "hover:border-primary/50 hover:shadow-glow-red cursor-pointer"
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {room.hasPassword && (
                          <Lock className="w-4 h-4 text-accent flex-shrink-0" />
                        )}
                        <h3 className="font-semibold truncate">
                          {room.title}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        방장: {room.host}
                      </p>
                    </div>
                    <div
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                        isFull
                          ? "bg-destructive/20 text-destructive"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      {room.currentPlayers}/{room.maxPlayers}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-card/80 backdrop-blur-md border-t border-border/50">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로 돌아가기
          </Button>
        </div>
      </footer>

      {/* Join Modal */}
      <Dialog
        open={!!selectedRoom}
        onOpenChange={() => setSelectedRoom(null)}
      >
        <DialogContent className="bg-card border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {selectedRoom?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label
                htmlFor="join-nickname"
                className="text-sm text-muted-foreground flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                닉네임
              </Label>
              <Input
                id="join-nickname"
                placeholder="닉네임을 입력하세요"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={12}
                className="bg-muted/50 border-border/50 focus-visible:ring-primary"
              />
            </div>

            {selectedRoom?.hasPassword && (
              <div className="space-y-2 animate-fade-in">
                <Label
                  htmlFor="join-password"
                  className="text-sm text-muted-foreground flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  비밀번호
                </Label>
                <Input
                  id="join-password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-muted/50 border-border/50 focus-visible:ring-primary"
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedRoom(null)}
              >
                취소
              </Button>
              <Button
                variant="gold"
                className="flex-1"
                onClick={handleJoin}
                disabled={!isJoinValid}
              >
                입장하기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

