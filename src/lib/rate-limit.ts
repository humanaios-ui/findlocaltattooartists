import { AppError } from "./errors";
import type { ServerEnv } from "./mode";

export interface RateLimitStore {
  /** Return false when this key is over the limit for the window. */
  take(key: string, limit: number, windowMs: number): Promise<boolean>;
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { remaining: number; resetAt: number }>();

  async take(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { remaining: limit - 1, resetAt: now + windowMs });
      return true;
    }
    if (current.remaining <= 0) return false;
    current.remaining -= 1;
    return true;
  }
}

let store: RateLimitStore = new MemoryRateLimitStore();

export function getRateLimitStore(): RateLimitStore {
  return store;
}

export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const allowed = await store.take(key, limit, windowMs);
  if (!allowed) throw new AppError("rate");
}

export function clientAddress(read: () => string): string {
  try {
    const value = read().trim();
    return value || "unknown";
  } catch {
    return "unknown";
  }
}

/** Turnstile runs only when TURNSTILE_SECRET_KEY is set. */
export async function assertTurnstile(token: string, ip: string, env: ServerEnv): Promise<void> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return;
  if (!token) throw new AppError("captcha");
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new AppError("captcha");
  const payload = (await response.json()) as { success?: boolean };
  if (!payload.success) throw new AppError("captcha");
}
