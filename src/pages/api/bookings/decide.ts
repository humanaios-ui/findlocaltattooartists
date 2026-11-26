export const prerender = false;

import type { APIRoute } from "astro";
import { siteConfig } from "../../../config/site";
import { bookingDecisionEmails } from "../../../lib/email/templates";
import { AppError } from "../../../lib/errors";
import { fail, formText, linkOrigin, readForm, redirect } from "../../../lib/http";
import { tryDeliver } from "../../../lib/notify";
import { getRepository } from "../../../lib/repository";
import type { ArtistAction } from "../../../lib/types";

const ACTIONS = new Set<ArtistAction>(["confirm", "decline", "propose", "cancel"]);

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const form = await readForm(request);
    const user = locals.user;
    if (!user || user.role !== "artist") throw new AppError("auth");
    const action = formText(form, "action");
    if (!ACTIONS.has(action as ArtistAction)) throw new AppError("status");
    const repo = await getRepository(cookies.get("sb-access-token")?.value);
    const result = await repo.decideBooking(user, formText(form, "booking_id"), action as ArtistAction, {
      proposedTime: formText(form, "proposed_time"),
      note: formText(form, "note"),
    });
    const label = action === "propose" ? "updated with a proposed time" : result.booking.status;
    const site = linkOrigin(request, { PUBLIC_SITE_URL: import.meta.env.PUBLIC_SITE_URL });
    await tryDeliver(
      bookingDecisionEmails({
        brand: siteConfig.brandName,
        guestName: result.booking.guestName,
        guestEmail: result.guestEmail,
        artistName: result.artistName,
        artistEmail: result.artistEmail,
        manageUrl: `${site}/bookings/${result.booking.manageToken}`,
        statusLabel: label,
        proposedTime: result.booking.proposedTime,
        note: result.booking.artistNote,
      }),
      repo,
      locals.demo,
    );
    return redirect("/artist/bookings?notice=updated");
  } catch (error) {
    return fail(error, "/artist/bookings");
  }
};
