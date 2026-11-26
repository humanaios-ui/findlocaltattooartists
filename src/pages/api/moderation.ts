export const prerender = false;

import type { APIRoute } from "astro";
import { AppError } from "../../lib/errors";
import { fail, formText, readForm, redirect } from "../../lib/http";
import { getRepository } from "../../lib/repository";
import type { ModerateAction } from "../../lib/types";

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const form = await readForm(request);
    if (locals.user?.role !== "admin") throw new AppError("forbidden");
    const repo = await getRepository(cookies.get("sb-access-token")?.value);
    const id = formText(form, "id");
    const action = formText(form, "action");
    const kind = formText(form, "kind");
    if (kind === "report" && action === "resolve") await repo.resolveReport(id);
    else if (action === "feature" || action === "unfeature") await repo.setFeatured(id, action === "feature");
    else if (kind === "image" && (action === "approve" || action === "hide" || action === "remove")) {
      await repo.moderateImage(id, action as ModerateAction);
    } else if (action === "approve" || action === "hide" || action === "remove") {
      await repo.moderateListing(id, action);
    } else {
      throw new AppError("status");
    }
    return redirect("/admin?notice=updated");
  } catch (error) {
    return fail(error, "/admin");
  }
};
