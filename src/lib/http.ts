import { resolveSiteUrl } from "../config/site";
import { AppError, isAppError } from "./errors";

export function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

export function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host");
  if (!host) throw new AppError("origin");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("origin");
  }
  if (originHost !== host) throw new AppError("origin");
}

/** Links in email use the canonical site, except when the form was submitted on localhost. */
export function linkOrigin(request: Request, env: { PUBLIC_SITE_URL?: string }): string {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0]?.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    const forwarded = request.headers.get("x-forwarded-proto");
    const proto = forwarded === "https" || new URL(request.url).protocol === "https:" ? "https" : "http";
    return `${proto}://${host}`;
  }
  return resolveSiteUrl(env);
}

export async function readForm(request: Request): Promise<FormData> {
  sameOrigin(request);
  return request.formData();
}

export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function formChecked(form: FormData, name: string): boolean {
  const value = form.get(name);
  return value === "on" || value === "yes" || value === "true";
}

export function safeNext(value: string | null, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return fallback;
  }
  return value;
}

export function fail(error: unknown, back: string): Response {
  const code = isAppError(error) ? error.code : "server";
  if (!isAppError(error)) console.error(error);
  return redirect(withCode(back, code));
}

function withCode(back: string, code: string): string {
  const join = back.includes("?") ? "&" : "?";
  return `${back}${join}error=${encodeURIComponent(code)}`;
}

export function secureCookie(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}
