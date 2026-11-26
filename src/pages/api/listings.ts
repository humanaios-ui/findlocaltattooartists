export const prerender = false;

import type { APIRoute } from "astro";
import { AppError } from "../../lib/errors";
import { fail, formChecked, formText, readForm, redirect } from "../../lib/http";
import { getRepository } from "../../lib/repository";
import type { ContactPreference } from "../../lib/types";
import { isCitySlug } from "../../lib/cities";

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const form = await readForm(request);
    const user = locals.user;
    if (!user || user.role !== "artist") throw new AppError("auth");
    const city = formText(form, "city");
    if (!isCitySlug(city)) throw new AppError("city");
    const repo = await getRepository(cookies.get("sb-access-token")?.value);
    await repo.saveListing(user, {
      displayName: formText(form, "display_name"),
      citySlug: city,
      shopName: formText(form, "shop_name"),
      bio: formText(form, "bio"),
      hours: formText(form, "hours"),
      contactPreference: formText(form, "contact_preference") as ContactPreference,
      phone: formText(form, "phone"),
      zip: formText(form, "zip"),
      styleSlugs: form.getAll("styles").filter((value): value is string => typeof value === "string"),
      published: formChecked(form, "published"),
    });
    return redirect("/artist/dashboard?notice=saved");
  } catch (error) {
    return fail(error, "/artist/listing");
  }
};
