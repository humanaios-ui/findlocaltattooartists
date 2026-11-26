export interface ServerEnv {
  PUBLIC_SUPABASE_URL?: string;
  PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SESSION_SECRET?: string;
  PUBLIC_SITE_URL?: string;
  RESEND_API_KEY?: string;
  POSTMARK_SERVER_TOKEN?: string;
  EMAIL_FROM?: string;
  FLTA_DEMO?: string;
}

export type DataMode =
  | { mode: "demo" }
  | { mode: "supabase"; url: string; anonKey: string; serviceRoleKey: string }
  | { mode: "misconfigured"; message: string };

export function readEnv(): ServerEnv {
  const pub = import.meta.env;
  return {
    PUBLIC_SUPABASE_URL: pub.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY: pub.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SESSION_SECRET: process.env.SESSION_SECRET,
    PUBLIC_SITE_URL: pub.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    POSTMARK_SERVER_TOKEN: process.env.POSTMARK_SERVER_TOKEN,
    EMAIL_FROM: process.env.EMAIL_FROM,
    FLTA_DEMO: process.env.FLTA_DEMO,
  };
}

export function resolveMode(env: ServerEnv): DataMode {
  const url = env.PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = env.PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const present = [url, anonKey, serviceRoleKey].filter(Boolean).length;
  if (present === 0) return { mode: "demo" };
  if (present === 3) return { mode: "supabase", url, anonKey, serviceRoleKey };
  return {
    mode: "misconfigured",
    message:
      "Supabase is only partly configured. Set PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY together, or leave all three empty to run the local demo.",
  };
}

/**
 * Demo data is for local development only.
 *
 * Do not trust `hostname` alone: on the Node adapter, Astro rebuilds the
 * request URL as `localhost` unless `security.allowedDomains` lists the host,
 * so a public server would look like localhost. Outside `astro dev`, demo
 * runs only when FLTA_DEMO=1 is set on purpose.
 */
export function demoAllowed(hostname: string, env: ServerEnv, isDev: boolean = import.meta.env.DEV): boolean {
  if (env.FLTA_DEMO === "0") return false;
  if (env.FLTA_DEMO === "1") return true;
  if (!isDev) return false;
  return isLoopbackHost(hostname);
}

/** True for localhost, 127.0.0.1 and ::1 (with or without brackets). */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function sessionSecret(env: ServerEnv, mode: "demo" | "supabase", isDev: boolean = import.meta.env.DEV): string {
  const secret = env.SESSION_SECRET?.trim() ?? "";
  if (secret.length >= 16) return secret;
  // The fixed demo secret is public, so it is only acceptable under `astro dev`.
  if (mode === "demo" && isDev) return "dev-only-demo-session-secret";
  throw new Error("Set SESSION_SECRET to a random string of at least 16 characters (also required for FLTA_DEMO=1 previews).");
}
