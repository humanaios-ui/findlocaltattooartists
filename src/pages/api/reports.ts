export const prerender = false;

import type { APIRoute } from "astro";
import { fail, formText, readForm, redirect } from "../../lib/http";
import { readEnv } from "../../lib/mode";
import { assertTurnstile, clientAddress, rateLimit } from "../../lib/rate-limit";
import { getRepository } from "../../lib/repository";

export const POST: APIRoute = async (context) => {
  const { request, cookies } = context;
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const back = slug ? `/artists/${slug}` : "/search";
  try {
    const form = await readForm(request);
    const ip = clientAddress(() => context.clientAddress);
    await rateLimit(`report:${ip}`, 10, 60 * 60 * 1000);
    await assertTurnstile(formText(form, "cf-turnstile-response"), ip, readEnv());
    const repo = await getRepository(cookies.get("sb-access-token")?.value);
    await repo.createReport({
      slug: formText(form, "slug"),
      email: formText(form, "email"),
      reason: formText(form, "reason"),
    });
    return redirect(`/artists/${formText(form, "slug")}?notice=sent`);
  } catch (error) {
    return fail(error, back);
  }
};
