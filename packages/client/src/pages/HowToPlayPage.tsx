import { useNavigate } from "react-router-dom";

export function HowToPlayPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold mb-2">게임하는 법</h1>
        <p className="text-sm text-gray-700">
          상세 룰/카드/역할 설명은 추후 문서를 기반으로 채워집니다.
        </p>
      </main>
      <footer className="p-4 border-t">
        <button
          type="button"
          className="w-full px-4 py-2 rounded bg-gray-800 text-white"
          onClick={() => navigate(-1)}
        >
          뒤로가기
        </button>
      </footer>
    </div>
  );
}

