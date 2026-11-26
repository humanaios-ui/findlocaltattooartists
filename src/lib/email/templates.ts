import { siteConfig } from "../../config/site";
import type { EmailMessage } from "./provider";

function wrap(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
}

export function bookingRequestedEmails(input: {
  brand?: string;
  guestName: string;
  guestEmail: string;
  artistName: string;
  artistEmail: string;
  manageUrl: string;
  dashboardUrl: string;
  preferredDates: string;
  notes: string;
}): EmailMessage[] {
  const brand = input.brand ?? siteConfig.brandName;
  const guestText = [
    `${input.guestName}, ${input.artistName} has your booking request.`,
    "This is a request, not a charge. Nothing is paid on this site, and it is not confirmed until the artist says so.",
    `Preferred dates: ${input.preferredDates}`,
    `Notes: ${input.notes}`,
    `Follow it here: ${input.manageUrl}`,
    brand,
  ].join("\n\n");
  const artistText = [
    `${input.artistName}, ${input.guestName} asked to book you.`,
    `${input.guestName} <${input.guestEmail}>`,
    `Preferred dates: ${input.preferredDates}`,
    `Notes: ${input.notes}`,
    `Confirm, decline, or propose another time: ${input.dashboardUrl}`,
    "This is a request, not a charge.",
    brand,
  ].join("\n\n");
  return [
    { to: input.guestEmail, subject: `Request sent to ${input.artistName}`, text: guestText, html: wrap(guestText) },
    { to: input.artistEmail, subject: `New booking request from ${input.guestName}`, text: artistText, html: wrap(artistText) },
  ];
}

export function bookingDecisionEmails(input: {
  brand?: string;
  guestName: string;
  guestEmail: string;
  artistName: string;
  artistEmail: string;
  manageUrl: string;
  statusLabel: string;
  proposedTime?: string | null;
  note?: string | null;
}): EmailMessage[] {
  const brand = input.brand ?? siteConfig.brandName;
  const extra = [
    input.proposedTime ? `Proposed time: ${input.proposedTime}` : "",
    input.note ? `Note: ${input.note}` : "",
  ].filter(Boolean);
  const guestText = [
    `${input.guestName}, your request with ${input.artistName} is now ${input.statusLabel}.`,
    ...extra,
    "This site does not take payment and does not hold a calendar.",
    `Details: ${input.manageUrl}`,
    brand,
  ].join("\n\n");
  const artistText = [
    `${input.artistName}, the request from ${input.guestName} is now ${input.statusLabel}.`,
    ...extra,
    brand,
  ].join("\n\n");
  return [
    { to: input.guestEmail, subject: `Booking request ${input.statusLabel}`, text: guestText, html: wrap(guestText) },
    { to: input.artistEmail, subject: `You marked a request ${input.statusLabel}`, text: artistText, html: wrap(artistText) },
  ];
}
