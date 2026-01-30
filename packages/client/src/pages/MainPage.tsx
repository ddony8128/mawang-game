import { Link, useNavigate } from "react-router-dom";

export function MainPage() {
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    // 실제 방 생성 로직은 추후 REST 연동
    navigate("/rooms");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold">마(피아)왕 게임</h1>
      <div className="flex flex-col gap-3 w-48">
        <button
          type="button"
          className="px-4 py-2 rounded bg-blue-600 text-white"
          onClick={() => navigate("/rooms")}
        >
          입장하기
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded bg-green-600 text-white"
          onClick={handleCreateRoom}
        >
          방 만들기
        </button>
        <Link
          to="/how-to-play"
          className="px-4 py-2 rounded border text-center"
        >
          게임하는 법
        </Link>
      </div>
    </div>
  );
}

