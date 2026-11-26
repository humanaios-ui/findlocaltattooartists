import { defineMiddleware } from "astro:middleware";
import { clearSession, writeSupabaseSession } from "./lib/auth/cookies";
import { verifySession } from "./lib/auth/session";
import { siteConfig } from "./config/site";
import { demoAllowed, readEnv, resolveMode, sessionSecret } from "./lib/mode";
import { getRepository } from "./lib/repository";

function plain(status: number, message: string): Response {
  const body = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${siteConfig.brandName}</title><body style="font-family:sans-serif;background:#070708;color:#fff;padding:2rem"><h1>${siteConfig.brandName}</h1><p>${message}</p></body></html>`;
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const env = readEnv();
  const mode = resolveMode(env);
  const allowedDemo = mode.mode === "demo" && demoAllowed(context.url.hostname, env);
  context.locals.demo = allowedDemo && !context.isPrerendered;
  context.locals.user = null;

  if (!context.isPrerendered) {
    if (mode.mode === "misconfigured") return plain(503, mode.message);
    if (mode.mode === "demo" && !allowedDemo) {
      return plain(
        503,
        "This server has no Supabase configuration. Demo artists only run under npm run dev. Set the Supabase keys, or set FLTA_DEMO=1 for a private preview.",
      );
    }
    if (mode.mode === "demo") {
      const token = context.cookies.get("flta_session")?.value;
      if (token) context.locals.user = await verifySession(token, sessionSecret(env, "demo"));
    } else if (mode.mode === "supabase") {
      const access = context.cookies.get("sb-access-token")?.value;
      const repo = await getRepository(access);
      if (access) context.locals.user = await repo.userFromAccessToken(access);
      if (!context.locals.user) {
        const refresh = context.cookies.get("sb-refresh-token")?.value;
        if (refresh) {
          const refreshed = await repo.refresh(refresh);
          if (refreshed?.tokens) {
            writeSupabaseSession(context.cookies, refreshed.tokens, context.url.protocol === "https:");
            context.locals.user = refreshed.user;
          } else {
            clearSession(context.cookies);
          }
        }
      }
    }
  }

  const response = await next();
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  return response;
});
