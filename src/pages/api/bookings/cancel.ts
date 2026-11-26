export const prerender = false;

import type { APIRoute } from "astro";
import { siteConfig } from "../../../config/site";
import { bookingDecisionEmails } from "../../../lib/email/templates";
import { fail, formText, linkOrigin, readForm, redirect } from "../../../lib/http";
import { tryDeliver } from "../../../lib/notify";
import { getRepository } from "../../../lib/repository";

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const back = token ? `/bookings/${token}` : "/";
  try {
    const form = await readForm(request);
    const manageToken = formText(form, "token");
    const repo = await getRepository(cookies.get("sb-access-token")?.value);
    const result = await repo.cancelByToken(manageToken);
    const site = linkOrigin(request, { PUBLIC_SITE_URL: import.meta.env.PUBLIC_SITE_URL });
    await tryDeliver(
      bookingDecisionEmails({
        brand: siteConfig.brandName,
        guestName: result.booking.guestName,
        guestEmail: result.guestEmail,
        artistName: result.artistName,
        artistEmail: result.artistEmail,
        manageUrl: `${site}/bookings/${result.booking.manageToken}`,
        statusLabel: "cancelled",
      }),
      repo,
      locals.demo,
    );
    return redirect(`/bookings/${result.booking.manageToken}?notice=updated`);
  } catch (error) {
    return fail(error, back);
  }
};
