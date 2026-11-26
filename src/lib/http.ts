import { resolveSiteUrl } from "../config/site";
import { AppError, isAppError } from "./errors";
import { isLoopbackHost } from "./mode";

export function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

/**
 * Form posts must carry a same-origin browser signal.
 * `Sec-Fetch-Site: same-origin` or `none` is enough. Otherwise `Origin` is required
 * and its host must match a parsed Host header.
 */
export function sameOrigin(request: Request): void {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") return;
  if (fetchSite === "cross-site" || fetchSite === "same-site") throw new AppError("origin");
  const origin = request.headers.get("origin");
  if (!origin) throw new AppError("origin");
  let originHost = "";
  try {
    originHost = new URL(origin).hostname.replace(/^\[|\]$/g, "");
  } catch {
    throw new AppError("origin");
  }
  const hostName = hostHeaderName(request.headers.get("host") ?? "");
  if (!hostName || originHost.toLowerCase() !== hostName) throw new AppError("origin");
}

/** Hostname from a Host header, or "" if it does not parse as a plain host[:port]. */
export function hostHeaderName(host: string): string {
  if (!host || /[\s/@?#\\]/.test(host)) return "";
  try {
    const parsed = new URL(`http://${host}`);
    const given = host.toLowerCase();
    // URL drops the default port, so "localhost:80" parses to host "localhost".
    const same = parsed.host === given || `${parsed.host}:80` === given;
    return same ? parsed.hostname.replace(/^\[|\]$/g, "") : "";
  } catch {
    return "";
  }
}

/** Links in email use the canonical site, except in local development on localhost. */
export function linkOrigin(
  request: Request,
  env: { PUBLIC_SITE_URL?: string },
  isDev: boolean = import.meta.env.DEV,
): string {
  const host = request.headers.get("host") ?? "";
  const hostname = hostHeaderName(host);
  if (isDev && isLoopbackHost(hostname)) {
    const forwarded = request.headers.get("x-forwarded-proto");
    const proto = forwarded === "https" || new URL(request.url).protocol === "https:" ? "https" : "http";
    return `${proto}://${host.toLowerCase()}`;
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

/**
 * Production cookies are always Secure. Behind a TLS proxy on the Node
 * adapter, request.url is http://localhost, so the protocol alone is wrong.
 * Browsers still accept Secure cookies on http://localhost.
 */
export function secureCookie(request: Request, isProd: boolean = import.meta.env.PROD): boolean {
  return isProd || new URL(request.url).protocol === "https:";
}
