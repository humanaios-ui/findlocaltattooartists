export const prerender = false;

import type { APIRoute } from "astro";
import { isCitySlug } from "../../lib/cities";
import { siteConfig } from "../../config/site";
import { bookingRequestedEmails } from "../../lib/email/templates";
import { AppError } from "../../lib/errors";
import { fail, formChecked, formText, linkOrigin, readForm, redirect } from "../../lib/http";
import { readEnv } from "../../lib/mode";
import { tryDeliver } from "../../lib/notify";
import { assertTurnstile, clientAddress, rateLimit } from "../../lib/rate-limit";
import { getRepository } from "../../lib/repository";

export const POST: APIRoute = async (context) => {
  const { request, locals, cookies } = context;
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const back = slug ? `/artists/${slug}#book` : "/search";
  try {
    const form = await readForm(request);
    const ip = clientAddress(() => context.clientAddress);
    const guestEmail = formText(form, "guest_email").trim().toLowerCase();
    await rateLimit(`booking-ip:${ip}`, 8, 60 * 60 * 1000);
    if (guestEmail) await rateLimit(`booking-email:${guestEmail}`, 5, 60 * 60 * 1000);
    await assertTurnstile(formText(form, "cf-turnstile-response"), ip, readEnv());
    const listingSlug = formText(form, "listing_slug");
    const city = formText(form, "preferred_city");
    if (!isCitySlug(city)) throw new AppError("city");
    const repo = await getRepository(cookies.get("sb-access-token")?.value);
    const created = await repo.createBooking({
      listingSlug,
      guestName: formText(form, "guest_name"),
      guestEmail: formText(form, "guest_email"),
      guestPhone: formText(form, "guest_phone"),
      preferredCity: city,
      notes: formText(form, "notes"),
      preferredDates: formText(form, "preferred_dates"),
      age: formChecked(form, "age"),
    });
    const site = linkOrigin(request, { PUBLIC_SITE_URL: import.meta.env.PUBLIC_SITE_URL });
    const sent = await tryDeliver(
      bookingRequestedEmails({
        brand: siteConfig.brandName,
        guestName: created.booking.guestName,
        guestEmail: created.booking.guestEmail,
        artistName: created.artistName,
        artistEmail: created.artistEmail,
        manageUrl: `${site}/bookings/${created.booking.manageToken}`,
        dashboardUrl: `${site}/artist/bookings`,
        preferredDates: created.booking.preferredDates,
        notes: created.booking.notes,
      }),
      repo,
      locals.demo,
    );
    const flag = sent ? "sent" : "email-failed";
    return redirect(`/bookings/${created.booking.manageToken}?notice=${flag}`);
  } catch (error) {
    return fail(error, back);
  }
};
