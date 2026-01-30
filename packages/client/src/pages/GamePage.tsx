import { useParams } from "react-router-dom";

export function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b">
        <h1 className="text-xl font-semibold">인게임</h1>
        <p className="text-xs text-gray-600">roomId: {roomId}</p>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <p className="text-sm text-gray-600">
          fogged 게임 상태와 WebSocket 연동은 추후 구현됩니다.
        </p>
      </main>
    </div>
  );
}

