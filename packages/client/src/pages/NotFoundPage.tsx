import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-dark">
      <div className="text-center px-6 space-y-4">
        <h1 className="text-5xl font-black text-gradient-evil">404</h1>
        <p className="text-lg text-muted-foreground">
          찾을 수 없는 페이지입니다.
        </p>
        <p className="text-sm text-muted-foreground/80">
          주소를 다시 확인하거나, 메인 화면으로 돌아가주세요.
        </p>
        <Button asChild variant="gold" className="mt-2">
          <Link to="/">홈으로 돌아가기</Link>
        </Button>
      </div>
    </div>
  );
}

