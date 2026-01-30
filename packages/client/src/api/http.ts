export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

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

