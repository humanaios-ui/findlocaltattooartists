export const prerender = false;

import type { APIRoute } from "astro";
import { fail, formText, readForm, redirect } from "../../lib/http";
import { getRepository } from "../../lib/repository";

export const POST: APIRoute = async ({ request, cookies }) => {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const back = slug ? `/artists/${slug}` : "/search";
  try {
    const form = await readForm(request);
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
