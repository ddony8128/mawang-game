import { useParams } from "react-router-dom";

export function LobbyPage() {
  const { roomId } = useParams<{ roomId: string }>();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b">
        <h1 className="text-xl font-semibold">대기실</h1>
        <p className="text-xs text-gray-600">roomId: {roomId}</p>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <p className="text-sm text-gray-600">
          대기실 UI와 폴링 로직은 추후 REST /poll 연동 시 구현됩니다.
        </p>
      </main>
    </div>
  );
}

