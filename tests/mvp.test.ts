import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "../src/lib/auth/session";
import { applyArtistAction, expireBooking } from "../src/lib/booking";
import { allKnownZips, cityForZip, CITIES } from "../src/lib/cities";
import { createDemoRepository } from "../src/lib/demo/repository";
import { buildSeedDatabase } from "../src/lib/demo/seed";
import { DEMO_ADMIN_PASSWORD, DEMO_ARTIST_PASSWORD } from "../src/lib/demo/passwords";
import { createNotificationProvider } from "../src/lib/email/provider";
import { bookingRequestedEmails } from "../src/lib/email/templates";
import { isWebp, validatePortfolioUpload } from "../src/lib/images";
import { requireAcknowledgements, validateListingInput } from "../src/lib/listing";
import { demoAllowed, resolveMode, sessionSecret } from "../src/lib/mode";
import { hostHeaderName, linkOrigin, secureCookie } from "../src/lib/http";
import { isPublicRecord, runSearch } from "../src/lib/search";
import { STYLES } from "../src/lib/styles";
import type { BookingRecord, SearchRecord } from "../src/lib/types";

const NOW = new Date("2026-11-26T18:00:00.000Z");

function webp(size = 120): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
  return bytes;
}

describe("two cities", () => {
  it("maps Phoenix and Fort Walton Beach ZIPs and rejects the rest", () => {
    expect(cityForZip("85004")).toBe("phoenix");
    expect(cityForZip("85251")).toBe("phoenix");
    expect(cityForZip("32547")).toBe("fort-walton-beach");
    expect(cityForZip("32548")).toBe("fort-walton-beach");
    expect(cityForZip("32541")).toBeNull();
    expect(cityForZip("85701")).toBeNull();
  });

  it("rejects a third city on a listing", () => {
    expect(() =>
      validateListingInput({
        displayName: "Someone",
        citySlug: "tucson" as "phoenix",
        shopName: "",
        bio: "x".repeat(40),
        hours: "By appointment",
        contactPreference: "email",
        phone: "",
        zip: "",
        styleSlugs: ["traditional"],
        published: true,
      }),
    ).toThrow(/city/);
  });
});

describe("search", () => {
  it("keeps cities apart, sorts featured first, and blocks other places", async () => {
    const repo = createDemoRepository(await buildSeedDatabase(), () => NOW);
    const phoenix = await repo.search({ q: "Phoenix" }, NOW);
    expect(phoenix.kind).toBe("results");
    if (phoenix.kind !== "results") return;
    expect(phoenix.results.map((card) => card.slug)).toEqual(["rosa-navarro", "leo-park"]);
    expect(phoenix.results[0]?.featured).toBe(true);

    const zip = await repo.search({ q: "85004" }, NOW);
    if (zip.kind !== "results") throw new Error("zip");
    expect(zip.results.every((card) => card.citySlug === "phoenix")).toBe(true);

    const fwb = await repo.search({ q: "32547" }, NOW);
    if (fwb.kind !== "results") throw new Error("fwb");
    expect(fwb.results.map((card) => card.citySlug)).toEqual(["fort-walton-beach", "fort-walton-beach"]);

    const style = await repo.search({ q: "Phoenix fine line" }, NOW);
    if (style.kind !== "results") throw new Error("style");
    expect(style.results.map((card) => card.slug)).toEqual(["rosa-navarro"]);

    expect((await repo.search({ q: "" }, NOW)).kind).toBe("picker");
    expect((await repo.search({ q: "Tucson" }, NOW)).kind).toBe("blocked");
    expect((await repo.search({ q: "Destin" }, NOW)).kind).toBe("blocked");
    expect(await repo.publicProfile("casey-quinn", NOW)).toBeNull();
    expect(await repo.publicProfile("riley-cho", NOW)).toBeNull();
    expect((await repo.cityListings("fort-walton-beach", NOW)).every((card) => card.citySlug === "fort-walton-beach")).toBe(true);
  });

  it("drops hidden rows even if they are handed to the search helper", () => {
    const hidden: SearchRecord = {
      slug: "secret",
      displayName: "Secret",
      citySlug: "phoenix",
      shopName: null,
      bio: "Should not appear in Phoenix results at all.",
      styleSlugs: ["traditional"],
      published: true,
      moderationStatus: "hidden",
      featured: true,
      featuredUntil: null,
      updatedAt: "2026-11-26T00:00:00.000Z",
      photoUrl: null,
      photoAlt: null,
    };
    const outcome = runSearch([hidden], { q: "Phoenix" }, NOW);
    expect(outcome.kind).toBe("results");
    if (outcome.kind === "results") expect(outcome.results).toHaveLength(0);
    expect(isPublicRecord(hidden)).toBe(false);
  });
});

describe("accounts, bookings, moderation", () => {
  it("requires both acknowledgements and then runs the request loop", async () => {
    expect(() => requireAcknowledgements({ age: false, imageRights: true })).toThrow(/age/);
    expect(() => requireAcknowledgements({ age: true, imageRights: false })).toThrow(/rights/);

    const repo = createDemoRepository(await buildSeedDatabase(), () => NOW);
    await expect(repo.signup({ email: "new@demo.invalid", password: "demo-pass-123", age: false, imageRights: true })).rejects.toThrow(/age/);

    const rosa = await repo.login("rosa@demo.invalid", DEMO_ARTIST_PASSWORD);
    const leo = await repo.login("leo@demo.invalid", DEMO_ARTIST_PASSWORD);
    expect(rosa?.user.artistId).toBeTruthy();
    const created = await repo.createBooking({
      listingSlug: "rosa-navarro",
      guestName: "Guest Example",
      guestEmail: "guest@example.com",
      guestPhone: "555-0100",
      preferredCity: "phoenix",
      notes: "A small black and grey piece.",
      preferredDates: "Next Tuesday afternoon",
      age: true,
    }, NOW);
    expect(created.booking.status).toBe("requested");
    await expect(repo.decideBooking(leo!.user, created.booking.id, "confirm", {}, NOW)).rejects.toThrow(/not-found/);
    const confirmed = await repo.decideBooking(rosa!.user, created.booking.id, "confirm", {}, NOW);
    expect(confirmed.booking.status).toBe("confirmed");
    const guest = await repo.bookingByToken(created.booking.manageToken, NOW);
    expect(guest?.booking.status).toBe("confirmed");

    await repo.moderateListing(created.booking.listingId, "hide", NOW);
    expect(await repo.publicProfile("rosa-navarro", NOW)).toBeNull();
  });

  it("keeps a pending artist out of search until approval", async () => {
    const repo = createDemoRepository(await buildSeedDatabase(), () => NOW);
    const before = await repo.search({ q: "Casey" }, NOW);
    if (before.kind !== "results") throw new Error("search");
    expect(before.results).toHaveLength(0);
    const queue = await repo.moderationQueue();
    const pending = queue.listings.find((listing) => listing.slug === "casey-quinn");
    expect(pending?.moderationStatus).toBe("pending");
    const casey = await repo.login("casey@demo.invalid", DEMO_ARTIST_PASSWORD);
    expect(casey?.user.artistId).toBeTruthy();
    const pendingImage = await repo.addImage(casey!.user, {
      bytes: webp(), alt: "Synthetic preview", tag: "unspecified", rights: true,
    });
    await repo.moderateListing(pending!.id, "approve", NOW);
    expect((await repo.publicProfile("casey-quinn", NOW))?.images.map((image) => image.id)).not.toContain(pendingImage.id);
    expect((await repo.moderationQueue()).images.find((image) => image.id === pendingImage.id)?.moderationStatus).toBe("pending");
    await repo.moderateImage(pendingImage.id, "approve");
    expect((await repo.publicProfile("casey-quinn", NOW))?.images.map((image) => image.id)).toContain(pendingImage.id);
    const after = await repo.search({ q: "Casey Quinn" }, NOW);
    if (after.kind !== "results") throw new Error("after");
    expect(after.results.map((card) => card.slug)).toContain("casey-quinn");
  });

  it("expires a stale request and rejects a bad transition", () => {
    const booking = {
      id: "b",
      listingId: "l",
      artistId: "a",
      guestName: "G",
      guestEmail: "g@example.com",
      guestPhone: "555",
      preferredCity: "phoenix" as const,
      notes: "notes",
      preferredDates: "soon",
      status: "requested" as const,
      proposedTime: null,
      artistNote: null,
      ageAcknowledgedAt: "2026-01-01T00:00:00.000Z",
      manageToken: "token",
      createdAt: "2026-11-20T00:00:00.000Z",
      updatedAt: "2026-11-20T00:00:00.000Z",
    } satisfies BookingRecord;
    expect(applyArtistAction(booking, "confirm", {}, NOW).status).toBe("confirmed");
    const confirmed = applyArtistAction(booking, "confirm", {}, NOW);
    expect(() => applyArtistAction(confirmed, "confirm", {}, NOW)).toThrow(/request/);
    const old = { ...booking, createdAt: "2026-10-01T00:00:00.000Z" };
    expect(expireBooking(old, NOW).status).toBe("expired");
    expect(() => applyArtistAction(old, "decline", {}, NOW)).toThrow(/request/);
  });
});

describe("images and mail", () => {
  it("rejects empty, tiny, and non-webp uploads", () => {
    expect(isWebp(new Uint8Array([1]))).toBe(false);
    expect(() => validatePortfolioUpload(new Uint8Array([1]), 0)).toThrow(/image-size/);
    expect(() => validatePortfolioUpload(new Uint8Array(), 0)).toThrow(/image-size/);
    expect(() => validatePortfolioUpload(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, ...new Uint8Array(120)]), 0)).toThrow(/image-type/);
    expect(() => validatePortfolioUpload(webp(), 12)).toThrow(/image-cap/);
    expect(() => validatePortfolioUpload(webp(), 0)).not.toThrow();
  });

  it("picks a provider without sending mail", () => {
    expect(createNotificationProvider({}).name).toBe("console");
    expect(createNotificationProvider({ RESEND_API_KEY: "rk", EMAIL_FROM: "a@example.com" }).name).toBe("resend");
    expect(createNotificationProvider({ POSTMARK_SERVER_TOKEN: "pk", EMAIL_FROM: "a@example.com" }).name).toBe("postmark");
    const [guest, artist] = bookingRequestedEmails({
      guestName: "Guest",
      guestEmail: "guest@example.com",
      artistName: "Rosa Navarro",
      artistEmail: "rosa@demo.invalid",
      manageUrl: "https://example.com/bookings/abc",
      dashboardUrl: "https://example.com/artist/bookings",
      preferredDates: "Tuesday",
      notes: "Fine line",
    });
    expect(guest?.text).toContain("https://example.com/bookings/abc");
    expect(guest?.text.toLowerCase()).toContain("not a charge");
    expect(artist?.to).toBe("rosa@demo.invalid");
  });
});

describe("guards", () => {
  it("does not enable demo data on a public host by default", () => {
    expect(resolveMode({})).toEqual({ mode: "demo" });
    expect(resolveMode({ PUBLIC_SUPABASE_URL: "https://example.supabase.co" }).mode).toBe("misconfigured");
    expect(resolveMode({
      PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
    }).mode).toBe("supabase");
    expect(demoAllowed("localhost", {})).toBe(true);
    expect(demoAllowed("findlocaltattooartists.com", {})).toBe(false);
    expect(demoAllowed("findlocaltattooartists.com", { FLTA_DEMO: "1" })).toBe(true);
    expect(demoAllowed("localhost", { FLTA_DEMO: "0" })).toBe(false);
  });

  it("keeps the schema aligned and leaves payments out", () => {
    const sql = readFileSync("supabase/migrations/20261126120000_init.sql", "utf8");
    for (const zip of allKnownZips()) expect(sql).toContain(`'${zip}'`);
    for (const city of CITIES) expect(sql).toContain(`'${city.slug}'`);
    for (const style of STYLES) expect(sql).toContain(`'${style.slug}'`);
    expect(sql).toContain("artists cannot change moderation, featured, or slug");
    expect(sql).not.toContain("stripe");

    const banned = /\bstripe\b|decap|amazon associates/i;
    function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return walk(path);
        return path.endsWith(".ts") || path.endsWith(".astro") || path.endsWith(".sql") || path.endsWith(".md") ? [path] : [];
      });
    }
    for (const file of [...walk("src"), ...walk("supabase"), "package.json"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(banned);
    }
  });

  it("signs a demo session and rejects tampering", async () => {
    const token = await signSession({ id: "u", email: "a@demo.invalid", role: "artist", artistId: "artist" }, "dev-only-demo-session-secret", NOW.getTime());
    const user = await verifySession(token, "dev-only-demo-session-secret", NOW.getTime());
    expect(user?.email).toBe("a@demo.invalid");
    expect(await verifySession(`${token}x`, "dev-only-demo-session-secret", NOW.getTime())).toBeNull();
    expect(await verifySession(token, "dev-only-demo-session-secret", NOW.getTime() + 40 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it("logs the demo artist in with the published fixture password", async () => {
    const repo = createDemoRepository(await buildSeedDatabase(), () => NOW);
    expect(await repo.login("admin@demo.invalid", DEMO_ADMIN_PASSWORD)).toMatchObject({ user: { role: "admin" } });
    expect(await repo.login("rosa@demo.invalid", "nope")).toBeNull();
  });
});

describe("production guards (review of #3)", () => {
  it("never enables demo data outside astro dev unless FLTA_DEMO=1", () => {
    // On the Node adapter a public request can look like localhost.
    expect(demoAllowed("localhost", {}, false)).toBe(false);
    expect(demoAllowed("127.0.0.1", {}, false)).toBe(false);
    expect(demoAllowed("localhost", { FLTA_DEMO: "1" }, false)).toBe(true);
    expect(demoAllowed("localhost", {}, true)).toBe(true);
    expect(demoAllowed("localhost", { FLTA_DEMO: "0" }, true)).toBe(false);
  });

  it("does not let a crafted Host header choose the link origin", () => {
    const env = { PUBLIC_SITE_URL: "https://example.com" };
    const req = (host: string) => new Request("http://localhost/api/bookings", { method: "POST", headers: { host } });
    expect(linkOrigin(req("localhost:80@evil.example"), env, true)).toBe("https://example.com");
    expect(linkOrigin(req("localhost:4321/evil"), env, true)).toBe("https://example.com");
    expect(linkOrigin(req("evil.example"), env, true)).toBe("https://example.com");
    expect(linkOrigin(req("localhost:4321"), env, false)).toBe("https://example.com");
    expect(linkOrigin(req("localhost:4321"), env, true)).toBe("http://localhost:4321");
    expect(hostHeaderName("[::1]:4321")).toBe("::1");
    expect(hostHeaderName("localhost:80@evil.example")).toBe("");
    expect(hostHeaderName("localhost:80")).toBe("localhost");
    expect(linkOrigin(req("localhost:80"), env, true)).toBe("http://localhost:80");
  });

  it("marks cookies Secure in production even when request.url is http", () => {
    const req = new Request("http://localhost/api/auth/login", { method: "POST" });
    expect(secureCookie(req, true)).toBe(true);
    expect(secureCookie(req, false)).toBe(false);
    expect(secureCookie(new Request("https://example.com/x"), false)).toBe(true);
  });
});

describe("demo session secret (review of #4)", () => {
  it("uses the fixed demo secret only in dev", () => {
    expect(sessionSecret({}, "demo", true)).toBe("dev-only-demo-session-secret");
    expect(() => sessionSecret({ FLTA_DEMO: "1" }, "demo", false)).toThrow(/SESSION_SECRET/);
    expect(sessionSecret({ SESSION_SECRET: "a-long-random-secret-value" }, "demo", false)).toBe("a-long-random-secret-value");
  });
});
