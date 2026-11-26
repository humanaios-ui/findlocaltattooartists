import { AppError } from "./errors";
import type { ArtistAction, BookingRecord } from "./types";

export const BOOKING_REQUEST_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function expireBooking(booking: BookingRecord, now: Date): BookingRecord {
  if (booking.status !== "requested") return booking;
  const age = now.getTime() - new Date(booking.createdAt).getTime();
  if (age < BOOKING_REQUEST_TTL_MS) return booking;
  return { ...booking, status: "expired", updatedAt: now.toISOString() };
}

export function applyArtistAction(
  booking: BookingRecord,
  action: ArtistAction,
  extra: { proposedTime?: string; note?: string },
  now: Date,
): BookingRecord {
  const current = expireBooking(booking, now);
  const note = extra.note?.trim() ? extra.note.trim().slice(0, 500) : current.artistNote;
  const at = now.toISOString();

  if (action === "propose") {
    const proposed = extra.proposedTime?.trim() ?? "";
    if (current.status !== "requested") throw new AppError("status", "That request can no longer be changed.");
    if (proposed.length < 2) throw new AppError("status", "Enter another time to propose.");
    return { ...current, proposedTime: proposed.slice(0, 160), artistNote: note, updatedAt: at };
  }

  if (action === "confirm") {
    if (current.status !== "requested") throw new AppError("status", "Only a new request can be confirmed.");
    return { ...current, status: "confirmed", artistNote: note, updatedAt: at };
  }

  if (action === "decline") {
    if (current.status !== "requested") throw new AppError("status", "Only a new request can be declined.");
    return { ...current, status: "declined", artistNote: note, updatedAt: at };
  }

  if (current.status !== "requested" && current.status !== "confirmed") {
    throw new AppError("status", "That request can no longer be cancelled.");
  }
  return { ...current, status: "cancelled", artistNote: note, updatedAt: at };
}

export function applyGuestCancel(booking: BookingRecord, now: Date): BookingRecord {
  return applyArtistAction(booking, "cancel", {}, now);
}
