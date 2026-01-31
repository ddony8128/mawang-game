// 기본 API 베이스 URL
// - 로컬 개발: VITE_API_BASE_URL=http://localhost:4000 처럼 설정
// - 프로덕션(Vercel): 환경변수를 비워 두면 상대 경로(/api/...) + vercel.json 리라이트를 사용
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
// 끝에 슬래시가 여러 개 붙어 있어도 한 번만 제거해 URL 이 "//api/..." 가 되는 것을 방지
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export class HttpError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function httpJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    // 먼저 기존 옵션을 펼치고, 마지막에 headers/credentials 를 정리해서 덮어쓴다.
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    credentials: "include",
  });

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const body = isJson ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    if (body && typeof body === "object" && "error" in body) {
      const err = (body as any).error;
      if (err && typeof err.message === "string") {
        message = err.message;
      }
    } else if (body && typeof body === "object" && "message" in body) {
      const m = (body as any).message;
      if (typeof m === "string") {
        message = m;
      }
    }
    throw new HttpError(response.status, message, body);
  }

  return body as T;
}

