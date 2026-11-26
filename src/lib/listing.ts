import { cityForZip, isCitySlug, type CitySlug } from "./cities";
import { AppError } from "./errors";
import { isStyleSlug } from "./styles";
import type { ContactPreference, ListingInput, ModerationStatus, ModerateAction } from "./types";

const CONTACT: ContactPreference[] = ["email", "phone", "either"];

export function slugifyName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "artist";
}

export function uniqueSlug(base: string, taken: (slug: string) => boolean): string {
  if (!taken(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const next = `${base}-${i}`;
    if (!taken(next)) return next;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export function requireAcknowledgements(input: { age: boolean; imageRights: boolean }): void {
  if (!input.age) throw new AppError("age");
  if (!input.imageRights) throw new AppError("rights");
}

export function requireBookingAge(age: boolean): void {
  if (!age) throw new AppError("age");
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateListingInput(raw: ListingInput): ListingInput {
  const displayName = raw.displayName.trim();
  const shopName = raw.shopName.trim();
  const bio = raw.bio.trim();
  const hours = raw.hours.trim() || "By appointment";
  const phone = raw.phone.trim();
  const zip = raw.zip.trim();
  const styleSlugs = [...new Set(raw.styleSlugs.map((slug) => slug.trim()).filter(Boolean))];

  if (displayName.length < 2 || displayName.length > 80) throw new AppError("name");
  if (!isCitySlug(raw.citySlug)) throw new AppError("city");
  if (shopName.length > 80) throw new AppError("name");
  if (bio.length < 40 || bio.length > 2000) throw new AppError("bio");
  if (hours.length < 2 || hours.length > 120) throw new AppError("hours");
  if (!CONTACT.includes(raw.contactPreference)) throw new AppError("phone");
  if ((raw.contactPreference === "phone" || raw.contactPreference === "either") && digits(phone).length < 7) {
    throw new AppError("phone");
  }
  if (phone && digits(phone).length < 7) throw new AppError("phone");
  if (zip && !/^\d{5}$/.test(zip)) throw new AppError("zip");
  if (zip && cityForZip(zip) !== raw.citySlug) throw new AppError("zip");
  if (styleSlugs.length < 1 || styleSlugs.length > 8 || styleSlugs.some((slug) => !isStyleSlug(slug))) {
    throw new AppError("styles");
  }

  return {
    displayName,
    citySlug: raw.citySlug as CitySlug,
    shopName,
    bio,
    hours,
    contactPreference: raw.contactPreference,
    phone,
    zip,
    styleSlugs,
    published: raw.published,
  };
}

export function nextModeration(action: ModerateAction): ModerationStatus {
  if (action === "approve") return "approved";
  if (action === "hide") return "hidden";
  return "removed";
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

export function validatePassword(password: string): void {
  if (password.length < 8 || password.length > 200) throw new AppError("password");
}
