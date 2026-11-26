import type { SessionUser } from "../types";
import { readPayload, signPayload } from "./webcrypto";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface SessionPayload extends SessionUser {
  exp: number;
}

export async function signSession(user: SessionUser, secret: string, now = Date.now()): Promise<string> {
  const payload: SessionPayload = { ...user, exp: now + THIRTY_DAYS_MS };
  return signPayload(payload, secret);
}

export async function verifySession(token: string, secret: string, now = Date.now()): Promise<SessionUser | null> {
  const payload = await readPayload<SessionPayload>(token, secret);
  if (!payload) return null;
  if (typeof payload.exp !== "number" || payload.exp < now) return null;
  if (payload.role !== "artist" && payload.role !== "admin") return null;
  if (typeof payload.id !== "string" || typeof payload.email !== "string") return null;
  return {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    artistId: payload.artistId ?? null,
  };
}
