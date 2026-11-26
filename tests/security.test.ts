import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sessionCookieOptions } from "../src/lib/auth/cookies";
import { signSession, verifySession } from "../src/lib/auth/session";
import { sameOrigin } from "../src/lib/http";
import { listingNeedsReview } from "../src/lib/listing";
import { demoAllowed } from "../src/lib/mode";
import { assertTurnstile, getRateLimitStore, rateLimit, setRateLimitStore, type RateLimitStore } from "../src/lib/rate-limit";
import type { ListingRecord } from "../src/lib/types";

function request(headers: Record<string, string>): Request {
  return { headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } } as Request;
}

const listing = {
  id: "l",
  artistId: "a",
  slug: "rosa",
  displayName: "Rosa",
  citySlug: "phoenix",
  shopName: "Shop",
  bio: "x".repeat(40),
  hours: "By appointment",
  contactPreference: "email",
  phone: null,
  zip: "85004",
  styleSlugs: ["fine-line"],
  published: true,
  moderationStatus: "approved",
  featured: true,
  featuredUntil: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
} satisfies ListingRecord;

describe("auth, cookies, and request gates", () => {
  it("does not treat a production localhost request as demo mode", () => {
    expect(demoAllowed("localhost", {}, false)).toBe(false);
    expect(demoAllowed("127.0.0.1", {}, false)).toBe(false);
    expect(demoAllowed("findlocaltattooartists.com", { FLTA_DEMO: "1" }, false)).toBe(true);
  });

  it("sets httpOnly Lax cookies and Secure in production", () => {
    expect(sessionCookieOptions(true)).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    expect(sessionCookieOptions(false).secure).toBe(false);
  });

  it("rejects a forged demo session signed with another secret", async () => {
    const token = await signSession(
      { id: "admin", email: "admin@demo.invalid", role: "admin", artistId: null },
      "dev-only-demo-session-secret",
    );
    expect(await verifySession(token, "a-different-production-secret")).toBeNull();
  });

  it("requires Origin or Sec-Fetch-Site on posts", () => {
    expect(() => sameOrigin(request({}))).toThrow(/origin/);
    expect(() => sameOrigin(request({ "sec-fetch-site": "cross-site", origin: "https://evil.example" }))).toThrow(/origin/);
    expect(() => sameOrigin(request({ "sec-fetch-site": "same-origin" }))).not.toThrow();
    expect(() => sameOrigin(request({ origin: "http://localhost:4321", host: "localhost:4321" }))).not.toThrow();
    expect(() => sameOrigin(request({ origin: "http://evil.example", host: "localhost:4321" }))).toThrow(/origin/);
  });

  it("does not send an unchanged approved listing back to review", () => {
    expect(listingNeedsReview(listing, {
      displayName: listing.displayName,
      citySlug: listing.citySlug,
      shopName: listing.shopName ?? "",
      bio: listing.bio,
      hours: listing.hours,
      contactPreference: listing.contactPreference,
      phone: listing.phone ?? "",
      zip: listing.zip ?? "",
      styleSlugs: [...listing.styleSlugs],
      published: false,
    })).toBe(false);
  });

  it("sends a public edit of an approved listing back to pending", () => {
    expect(listingNeedsReview(listing, {
      displayName: "Rosa Navarro",
      citySlug: "phoenix",
      shopName: "Shop",
      bio: listing.bio,
      hours: listing.hours,
      contactPreference: "email",
      phone: "",
      zip: "85004",
      styleSlugs: ["fine-line"],
      published: true,
    })).toBe(true);
    expect(listingNeedsReview({ ...listing, moderationStatus: "pending" }, {
      displayName: "Changed",
      citySlug: "phoenix",
      shopName: "",
      bio: listing.bio,
      hours: listing.hours,
      contactPreference: "email",
      phone: "",
      zip: "",
      styleSlugs: ["fine-line"],
      published: true,
    })).toBe(false);
  });

  it("uses a replaceable rate-limit store and skips Turnstile without a secret", async () => {
    const previous = getRateLimitStore();
    const seen: string[] = [];
    const blocking: RateLimitStore = {
      async take(key) {
        seen.push(key);
        return false;
      },
    };
    setRateLimitStore(blocking);
    await expect(rateLimit("signup:1.2.3.4", 5, 1000)).rejects.toThrow(/rate/);
    expect(seen).toEqual(["signup:1.2.3.4"]);
    setRateLimitStore(previous);
    await expect(assertTurnstile("", "127.0.0.1", {})).resolves.toBeUndefined();
  });

  it("keeps the portfolio bucket private in the migration", () => {
    const sql = readFileSync("supabase/migrations/20261126120000_init.sql", "utf8");
    expect(sql).toContain("('portfolio', 'portfolio', false,");
    expect(sql).not.toContain("create policy portfolio_public_read");
    expect(sql).toContain("new.moderation_status := 'pending'");
    expect(sql).toContain("requeue_listing_on_style_change");
  });
});
