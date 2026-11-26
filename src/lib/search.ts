import {
  CITY_ALIASES,
  cityForZip,
  cityLabel,
  isCitySlug,
  OUTSIDE_PLACES,
  type CitySlug,
} from "./cities";
import { isStyleSlug, normalizePhrase, styleBySlug, styleName, stylePhrases } from "./styles";
import type { PublicCard, SearchOutcome, SearchRecord } from "./types";

export interface ParsedSearch {
  kind: "picker" | "blocked" | "results";
  place?: string;
  city: CitySlug | null;
  styleSlug: string | null;
  text: string | null;
}

function padded(value: string): string {
  return ` ${value} `;
}

function hasPhrase(normalized: string, phrase: string): boolean {
  return padded(normalized).includes(` ${phrase} `);
}

function removePhrase(normalized: string, phrase: string): string {
  return padded(normalized)
    .replace(` ${phrase} `, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const ALIASES = [...CITY_ALIASES].sort((a, b) => b.phrase.length - a.phrase.length);
const OUTSIDE = [...OUTSIDE_PLACES].sort((a, b) => b.length - a.length);

function matchAlias(normalized: string): { slug: CitySlug; rest: string; phrase: string } | null {
  for (const alias of ALIASES) {
    if (hasPhrase(normalized, alias.phrase)) {
      return { slug: alias.slug, rest: removePhrase(normalized, alias.phrase), phrase: alias.phrase };
    }
  }
  return null;
}

function matchOutside(normalized: string): string | null {
  for (const place of OUTSIDE) {
    if (hasPhrase(normalized, place)) return place;
  }
  return null;
}

function matchStyle(normalized: string): { slug: string; rest: string } | null {
  for (const style of stylePhrases()) {
    if (hasPhrase(normalized, style.phrase)) {
      return { slug: style.slug, rest: removePhrase(normalized, style.phrase) };
    }
  }
  return null;
}

export function parseSearch(input: {
  q?: string | null;
  city?: string | null;
  style?: string | null;
}): ParsedSearch {
  const qRaw = (input.q ?? "").trim();
  const cityParam = (input.city ?? "").trim();
  const styleParam = (input.style ?? "").trim();

  let city: CitySlug | null = null;
  if (cityParam) {
    if (!isCitySlug(cityParam)) return { kind: "blocked", place: cityParam.slice(0, 40), city: null, styleSlug: null, text: null };
    city = cityParam;
  }

  let styleSlug: string | null = null;
  if (styleParam) {
    if (!isStyleSlug(styleParam)) {
      return { kind: "blocked", place: styleParam.slice(0, 40), city: null, styleSlug: null, text: null };
    }
    styleSlug = styleParam;
  }

  if (!qRaw) {
    if (!city && !styleSlug) return { kind: "picker", city: null, styleSlug: null, text: null };
    return { kind: "results", city, styleSlug, text: null };
  }

  const zipMatch = qRaw.match(/\b(\d{5})\b/);
  if (zipMatch) {
    const fromZip = cityForZip(zipMatch[1]);
    if (!fromZip) return { kind: "blocked", place: zipMatch[1], city: null, styleSlug: null, text: null };
    if (city && city !== fromZip) return { kind: "blocked", place: zipMatch[1], city: null, styleSlug: null, text: null };
    city = fromZip;
  }

  let normalized = normalizePhrase(qRaw.replace(/\b\d{5}\b/g, " "));
  const alias = matchAlias(normalized);
  if (alias) {
    if (city && city !== alias.slug) {
      return { kind: "blocked", place: alias.phrase, city: null, styleSlug: null, text: null };
    }
    city = alias.slug;
    normalized = alias.rest;
  }

  const outside = matchOutside(normalized);
  if (outside) return { kind: "blocked", place: outside, city: null, styleSlug: null, text: null };

  if (!city && (normalized === "florida" || normalized === "arizona")) {
    return { kind: "blocked", place: normalized, city: null, styleSlug: null, text: null };
  }
  if (city) {
    normalized = removePhrase(normalized, "florida");
    normalized = removePhrase(normalized, "arizona");
  }

  const style = matchStyle(normalized);
  if (style) {
    if (styleSlug && styleSlug !== style.slug) {
      return { kind: "blocked", place: style.slug, city: null, styleSlug: null, text: null };
    }
    styleSlug = style.slug;
    normalized = style.rest;
  }

  const text = normalized.trim();
  return { kind: "results", city, styleSlug, text: text.length >= 2 ? text : null };
}

export function isPublicRecord(record: Pick<SearchRecord, "published" | "moderationStatus">): boolean {
  return record.published && record.moderationStatus === "approved";
}

export function isFeaturedActive(
  record: Pick<SearchRecord, "featured" | "featuredUntil">,
  now: Date,
): boolean {
  if (!record.featured) return false;
  if (!record.featuredUntil) return true;
  return new Date(record.featuredUntil).getTime() > now.getTime();
}

function haystack(record: SearchRecord): string {
  const styleNames = record.styleSlugs.map((slug) => styleName(slug)).join(" ");
  return normalizePhrase(`${record.displayName} ${record.shopName ?? ""} ${record.bio} ${styleNames}`);
}

export function queryRecords(
  records: SearchRecord[],
  filter: { city: CitySlug | null; styleSlug: string | null; text: string | null },
  now: Date,
): PublicCard[] {
  const text = filter.text ? normalizePhrase(filter.text) : null;
  const matched = records.filter((record) => {
    if (!isPublicRecord(record)) return false;
    if (filter.city && record.citySlug !== filter.city) return false;
    if (filter.styleSlug && !record.styleSlugs.includes(filter.styleSlug)) return false;
    if (text && !haystack(record).includes(text)) return false;
    return true;
  });

  matched.sort((a, b) => {
    const featuredDelta = Number(isFeaturedActive(b, now)) - Number(isFeaturedActive(a, now));
    if (featuredDelta !== 0) return featuredDelta;
    if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
    return a.displayName.localeCompare(b.displayName);
  });

  return matched.map((record) => ({
    slug: record.slug,
    displayName: record.displayName,
    citySlug: record.citySlug,
    cityLabel: cityLabel(record.citySlug),
    shopName: record.shopName,
    styles: record.styleSlugs.map((slug) => ({ slug, name: styleName(slug) })),
    featured: isFeaturedActive(record, now),
    photoUrl: record.photoUrl,
    photoAlt: record.photoAlt,
  }));
}

export function runSearch(records: SearchRecord[], input: {
  q?: string | null;
  city?: string | null;
  style?: string | null;
}, now = new Date()): SearchOutcome {
  const parsed = parseSearch(input);
  if (parsed.kind === "picker") return { kind: "picker" };
  if (parsed.kind === "blocked") return { kind: "blocked", place: parsed.place ?? "that place" };
  return {
    kind: "results",
    city: parsed.city,
    styleName: parsed.styleSlug ? (styleBySlug(parsed.styleSlug)?.name ?? null) : null,
    text: parsed.text,
    results: queryRecords(records, parsed, now),
  };
}
