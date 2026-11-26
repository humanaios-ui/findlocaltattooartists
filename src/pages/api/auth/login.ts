export const prerender = false;

import type { APIRoute } from "astro";
import { writeDemoSession, writeSupabaseSession } from "../../../lib/auth/cookies";
import { signSession } from "../../../lib/auth/session";
import { AppError } from "../../../lib/errors";
import { fail, formText, readForm, redirect, safeNext, secureCookie } from "../../../lib/http";
import { readEnv, resolveMode, sessionSecret } from "../../../lib/mode";
import { getRepository } from "../../../lib/repository";

export const POST: APIRoute = async ({ request, cookies }) => {
  let back = "/artist/login";
  try {
    const form = await readForm(request);
    back = safeNext(formText(form, "back"), "/artist/login");
    const mode = resolveMode(readEnv());
    if (mode.mode === "misconfigured") throw new AppError("config", mode.message);
    const result = await (await getRepository()).login(formText(form, "email"), formText(form, "password"));
    if (!result) return redirect(`${back}${back.includes("?") ? "&" : "?"}error=credentials`);
    const secure = secureCookie(request);
    if (result.tokens) writeSupabaseSession(cookies, result.tokens, secure);
    else writeDemoSession(cookies, await signSession(result.user, sessionSecret(readEnv(), "demo")), secure);
    const dest = safeNext(formText(form, "next"), result.user.role === "admin" ? "/admin" : "/artist/dashboard");
    return redirect(dest);
  } catch (error) {
    return fail(error, back);
  }
};
