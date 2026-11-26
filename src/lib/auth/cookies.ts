import type { APIContext } from "astro";
import type { AuthTokens } from "../types";

type Cookies = APIContext["cookies"];

const base = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export function writeDemoSession(cookies: Cookies, token: string, secure: boolean): void {
  cookies.set("flta_session", token, { ...base, secure, maxAge: 60 * 60 * 24 * 30 });
  cookies.delete("sb-access-token", { path: "/" });
  cookies.delete("sb-refresh-token", { path: "/" });
}

export function writeSupabaseSession(cookies: Cookies, tokens: AuthTokens, secure: boolean): void {
  cookies.set("sb-access-token", tokens.accessToken, { ...base, secure, maxAge: 60 * 60 * 24 * 30 });
  cookies.set("sb-refresh-token", tokens.refreshToken, { ...base, secure, maxAge: 60 * 60 * 24 * 30 });
  cookies.delete("flta_session", { path: "/" });
}

export function clearSession(cookies: Cookies): void {
  cookies.delete("flta_session", { path: "/" });
  cookies.delete("sb-access-token", { path: "/" });
  cookies.delete("sb-refresh-token", { path: "/" });
}
