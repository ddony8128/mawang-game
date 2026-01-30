import { Link } from "react-router-dom";

export function RoomsPage() {
  // v1: 실제 방 목록은 아직 REST 연동 전이므로 placeholder
  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b flex items-center justify-between">
        <h1 className="text-xl font-semibold">대기 중인 방</h1>
        <button
          type="button"
          className="px-3 py-1 text-sm rounded border"
        >
          새로고침
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-2">
        <p className="text-sm text-gray-600">
          방 목록 API 연동 전입니다. 추후 REST /api/rooms 결과를 표시합니다.
        </p>
      </main>
      <footer className="p-4 border-t">
        <Link
          to="/"
          className="w-full inline-flex items-center justify-center px-4 py-2 rounded bg-gray-800 text-white"
        >
          뒤로 돌아가기
        </Link>
      </footer>
    </div>
  );
}

