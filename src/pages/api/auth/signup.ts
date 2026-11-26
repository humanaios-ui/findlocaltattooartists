export const prerender = false;

import type { APIRoute } from "astro";
import { writeDemoSession, writeSupabaseSession } from "../../../lib/auth/cookies";
import { signSession } from "../../../lib/auth/session";
import { AppError } from "../../../lib/errors";
import { fail, formChecked, formText, readForm, redirect, secureCookie } from "../../../lib/http";
import { readEnv, resolveMode, sessionSecret } from "../../../lib/mode";
import { assertTurnstile, clientAddress, rateLimit } from "../../../lib/rate-limit";
import { getRepository } from "../../../lib/repository";

export const POST: APIRoute = async (context) => {
  try {
    const { request, cookies } = context;
    const form = await readForm(request);
    const ip = clientAddress(() => context.clientAddress);
    await rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
    await assertTurnstile(formText(form, "cf-turnstile-response"), ip, readEnv());
    const mode = resolveMode(readEnv());
    if (mode.mode === "misconfigured") throw new AppError("config", mode.message);
    const result = await (await getRepository()).signup({
      email: formText(form, "email"),
      password: formText(form, "password"),
      age: formChecked(form, "age"),
      imageRights: formChecked(form, "image_rights"),
    });
    if (result.confirmEmail) return redirect("/artist/signup?notice=confirm-email");
    const secure = secureCookie(request);
    if (result.tokens) writeSupabaseSession(cookies, result.tokens, secure);
    else writeDemoSession(cookies, await signSession(result.user, sessionSecret(readEnv(), "demo")), secure);
    return redirect("/artist/listing");
  } catch (error) {
    return fail(error, "/artist/signup");
  }
};
