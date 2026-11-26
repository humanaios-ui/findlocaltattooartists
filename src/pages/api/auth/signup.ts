export const prerender = false;

import type { APIRoute } from "astro";
import { writeDemoSession, writeSupabaseSession } from "../../../lib/auth/cookies";
import { signSession } from "../../../lib/auth/session";
import { AppError } from "../../../lib/errors";
import { fail, formChecked, formText, readForm, redirect, secureCookie } from "../../../lib/http";
import { readEnv, resolveMode, sessionSecret } from "../../../lib/mode";
import { getRepository } from "../../../lib/repository";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const form = await readForm(request);
    const mode = resolveMode(readEnv());
    if (mode.mode === "misconfigured") throw new AppError("config", mode.message);
    const result = await (await getRepository()).signup({
      email: formText(form, "email"),
      password: formText(form, "password"),
      age: formChecked(form, "age"),
      imageRights: formChecked(form, "image_rights"),
    });
    const secure = secureCookie(request);
    if (result.tokens) writeSupabaseSession(cookies, result.tokens, secure);
    else writeDemoSession(cookies, await signSession(result.user, sessionSecret(readEnv(), "demo")), secure);
    return redirect("/artist/listing");
  } catch (error) {
    return fail(error, "/artist/signup");
  }
};
