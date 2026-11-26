export const prerender = false;

import type { APIRoute } from "astro";
import { clearSession } from "../../../lib/auth/cookies";
import { fail, readForm, redirect } from "../../../lib/http";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    await readForm(request);
    clearSession(cookies);
    return redirect("/");
  } catch (error) {
    return fail(error, "/");
  }
};
