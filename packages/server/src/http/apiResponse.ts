import type { Response } from "express";

type ApiError = {
  code: string;
  message: string;
};

export function sendOk<T>(res: Response, data: T) {
  res.json({ ok: true, data });
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  status = 400,
) {
  const error: ApiError = { code, message };
  res.status(status).json({ ok: false, error });
}

