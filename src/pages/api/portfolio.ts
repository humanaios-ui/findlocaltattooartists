export const prerender = false;

import type { APIRoute } from "astro";
import { AppError } from "../../lib/errors";
import { parseImageTag } from "../../lib/images";
import { fail, formChecked, formText, readForm, redirect } from "../../lib/http";
import { getRepository } from "../../lib/repository";

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const form = await readForm(request);
    const user = locals.user;
    if (!user || user.role !== "artist") throw new AppError("auth");
    const repo = await getRepository(cookies.get("sb-access-token")?.value);
    if (formText(form, "intent") === "delete") {
      await repo.deleteImage(user, formText(form, "image_id"));
      return redirect("/artist/dashboard?notice=updated");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("image");
    await repo.addImage(user, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      alt: formText(form, "alt"),
      tag: parseImageTag(formText(form, "tag") || "unspecified"),
      rights: formChecked(form, "image_rights"),
    });
    return redirect("/artist/dashboard?notice=saved");
  } catch (error) {
    return fail(error, "/artist/dashboard");
  }
};
