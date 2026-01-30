import { useParams } from "react-router-dom";

export function ResultPage() {
  const { roomId } = useParams<{ roomId: string }>();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b">
        <h1 className="text-xl font-semibold">결과 화면</h1>
        <p className="text-xs text-gray-600">roomId: {roomId}</p>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <p className="text-sm text-gray-600">
          GameEndState 기반 결과 리스트는 추후 WS end 패킷 연동 시 구현됩니다.
        </p>
      </main>
    </div>
  );
}

