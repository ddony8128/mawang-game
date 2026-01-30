import crypto from "crypto";

const secret = process.env.SESSION_TOKEN_SECRET ?? "";

export function hashSessionToken(token: string): string {
  if (!secret) {
    throw new Error("SESSION_TOKEN_SECRET is not set");
  }

  return crypto.createHmac("sha256", secret).update(token, "utf8").digest("hex");
}

