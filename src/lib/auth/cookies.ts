import type { APIContext } from "astro";
import type { AuthTokens } from "../types";

type Cookies = APIContext["cookies"];

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
    maxAge: 60 * 60 * 24 * 30,
  };
}

export function writeDemoSession(cookies: Cookies, token: string, secure: boolean): void {
  cookies.set("flta_session", token, sessionCookieOptions(secure));
  cookies.delete("sb-access-token", { path: "/" });
  cookies.delete("sb-refresh-token", { path: "/" });
}

export function writeSupabaseSession(cookies: Cookies, tokens: AuthTokens, secure: boolean): void {
  cookies.set("sb-access-token", tokens.accessToken, sessionCookieOptions(secure));
  cookies.set("sb-refresh-token", tokens.refreshToken, sessionCookieOptions(secure));
  cookies.delete("flta_session", { path: "/" });
}

export function clearSession(cookies: Cookies): void {
  cookies.delete("flta_session", { path: "/" });
  cookies.delete("sb-access-token", { path: "/" });
  cookies.delete("sb-refresh-token", { path: "/" });
}
