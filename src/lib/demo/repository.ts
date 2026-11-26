import { cityLabel, isCitySlug } from "../cities";
import { applyArtistAction, applyGuestCancel, expireBooking } from "../booking";
import { AppError } from "../errors";
import { validateImageMeta, validatePortfolioUpload } from "../images";
import {
  isEmail,
  nextModeration,
  requireAcknowledgements,
  requireBookingAge,
  slugifyName,
  uniqueSlug,
  validateListingInput,
  validatePassword,
} from "../listing";
import { isFeaturedActive, isPublicRecord, queryRecords, runSearch } from "../search";
import { styleBySlug } from "../styles";
import type {
  ArtistAction,
  BookingDecision,
  BookingInput,
  BookingRecord,
  DashboardData,
  DataRepository,
  GuestBooking,
  ListingInput,
  ListingRecord,
  LoginResult,
  ModerateAction,
  ModerationQueue,
  NewImageInput,
  PortfolioImageRecord,
  PublicProfile,
  SearchRecord,
  SessionUser,
  SignupInput,
  StoredEmail,
} from "../types";
import { bytesToBase64, hashPassword, randomToken, verifyPassword } from "../auth/webcrypto";
import type { DemoDatabase } from "./seed";

function nowIso(now: Date): string {
  return now.toISOString();
}

function stylesOf(slugs: string[]): { slug: string; name: string }[] {
  return slugs.map((slug) => ({ slug, name: styleBySlug(slug)?.name ?? slug }));
}

export function createDemoRepository(db: DemoDatabase, clock: () => Date = () => new Date()): DataRepository {
  const at = () => clock();

  function records(): SearchRecord[] {
    return db.listings.map((listing) => {
      const photo = db.images
        .filter((image) => image.listingId === listing.id && image.moderationStatus === "approved")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      return {
        slug: listing.slug,
        displayName: listing.displayName,
        citySlug: listing.citySlug,
        shopName: listing.shopName,
        bio: listing.bio,
        styleSlugs: listing.styleSlugs,
        published: listing.published,
        moderationStatus: listing.moderationStatus,
        featured: listing.featured,
        featuredUntil: listing.featuredUntil,
        updatedAt: listing.updatedAt,
        photoUrl: photo?.url ?? null,
        photoAlt: photo?.alt ?? null,
      };
    });
  }

  function listingBySlug(slug: string): ListingRecord | undefined {
    return db.listings.find((listing) => listing.slug === slug);
  }

  function artistById(id: string) {
    return db.artists.find((artist) => artist.id === id);
  }

  function touchBooking(booking: BookingRecord, now: Date): BookingRecord {
    const next = expireBooking(booking, now);
    if (next !== booking) Object.assign(booking, next);
    return booking;
  }

  function toSession(user: DemoDatabase["users"][number]): SessionUser {
    return { id: user.id, email: user.email, role: user.role, artistId: user.artistId };
  }

  function requireArtist(user: SessionUser): string {
    if (user.role !== "artist" || !user.artistId) throw new AppError("forbidden");
    return user.artistId;
  }

  return {
    mode: "demo",

    async search(input, now = at()) {
      return runSearch(records(), input, now);
    },

    async cityListings(city, now = at()) {
      return queryRecords(records(), { city, styleSlug: null, text: null }, now);
    },

    async publicProfile(slug, now = at()): Promise<PublicProfile | null> {
      const listing = listingBySlug(slug);
      if (!listing || !isPublicRecord(listing)) return null;
      const images = db.images
        .filter((image) => image.listingId === listing.id && image.moderationStatus === "approved")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        listing,
        images,
        cityLabel: cityLabel(listing.citySlug),
        styles: stylesOf(listing.styleSlugs),
        featured: isFeaturedActive(listing, now),
      };
    },

    async signup(input: SignupInput): Promise<LoginResult> {
      requireAcknowledgements(input);
      const email = input.email.trim().toLowerCase();
      if (!isEmail(email)) throw new AppError("email");
      validatePassword(input.password);
      if (db.users.some((user) => user.email === email)) throw new AppError("email-taken");
      const stamp = nowIso(at());
      const userId = crypto.randomUUID();
      const artistId = crypto.randomUUID();
      const salt = randomToken().slice(0, 16);
      const passwordHash = await hashPassword(input.password, salt);
      db.users.push({ id: userId, email, passwordSalt: salt, passwordHash, role: "artist", artistId });
      db.artists.push({
        id: artistId,
        userId,
        email,
        ageAcknowledgedAt: stamp,
        imageRightsAcknowledgedAt: stamp,
        createdAt: stamp,
      });
      return { user: { id: userId, email, role: "artist", artistId }, tokens: null };
    },

    async login(email, password): Promise<LoginResult | null> {
      const user = db.users.find((item) => item.email === email.trim().toLowerCase());
      if (!user) return null;
      const ok = await verifyPassword(password, user.passwordSalt, user.passwordHash);
      if (!ok) return null;
      return { user: toSession(user), tokens: null };
    },

    async userFromAccessToken() {
      return null;
    },

    async refresh() {
      return null;
    },

    async dashboard(user, now = at()): Promise<DashboardData> {
      const artistId = requireArtist(user);
      const listing = db.listings.find((item) => item.artistId === artistId) ?? null;
      const images = listing
        ? db.images.filter((image) => image.listingId === listing.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        : [];
      const requestedCount = db.bookings.filter((booking) => {
        if (booking.artistId !== artistId) return false;
        return touchBooking(booking, now).status === "requested";
      }).length;
      return { email: user.email, listing, images, requestedCount };
    },

    async saveListing(user, input: ListingInput): Promise<ListingRecord> {
      const artistId = requireArtist(user);
      const value = validateListingInput(input);
      const stamp = nowIso(at());
      const existing = db.listings.find((listing) => listing.artistId === artistId);
      if (!existing) {
        const listing: ListingRecord = {
          id: crypto.randomUUID(),
          artistId,
          slug: uniqueSlug(slugifyName(value.displayName), (slug) => db.listings.some((item) => item.slug === slug)),
          displayName: value.displayName,
          citySlug: value.citySlug,
          shopName: value.shopName || null,
          bio: value.bio,
          hours: value.hours,
          contactPreference: value.contactPreference,
          phone: value.phone || null,
          zip: value.zip || null,
          styleSlugs: value.styleSlugs,
          published: value.published,
          moderationStatus: "pending",
          featured: false,
          featuredUntil: null,
          createdAt: stamp,
          updatedAt: stamp,
        };
        db.listings.push(listing);
        return listing;
      }
      existing.displayName = value.displayName;
      existing.citySlug = value.citySlug;
      existing.shopName = value.shopName || null;
      existing.bio = value.bio;
      existing.hours = value.hours;
      existing.contactPreference = value.contactPreference;
      existing.phone = value.phone || null;
      existing.zip = value.zip || null;
      existing.styleSlugs = value.styleSlugs;
      existing.published = value.published;
      existing.updatedAt = stamp;
      return existing;
    },

    async addImage(user, input: NewImageInput): Promise<PortfolioImageRecord> {
      const artistId = requireArtist(user);
      const listing = db.listings.find((item) => item.artistId === artistId);
      if (!listing) throw new AppError("not-found");
      const meta = validateImageMeta(input);
      const count = db.images.filter((image) => image.listingId === listing.id && image.moderationStatus !== "removed").length;
      validatePortfolioUpload(input.bytes, count);
      const image: PortfolioImageRecord = {
        id: crypto.randomUUID(),
        listingId: listing.id,
        alt: meta.alt,
        tag: input.tag,
        url: `data:image/webp;base64,${bytesToBase64(input.bytes)}`,
        bytes: input.bytes.byteLength,
        moderationStatus: "pending",
        rightsAcknowledgedAt: nowIso(at()),
        createdAt: nowIso(at()),
      };
      db.images.push(image);
      listing.updatedAt = image.createdAt;
      return image;
    },

    async deleteImage(user, imageId) {
      const artistId = requireArtist(user);
      const listing = db.listings.find((item) => item.artistId === artistId);
      const index = db.images.findIndex((image) => image.id === imageId && image.listingId === listing?.id);
      if (index < 0) throw new AppError("not-found");
      db.images.splice(index, 1);
    },

    async createBooking(input: BookingInput, now = at()) {
      requireBookingAge(input.age);
      const listing = listingBySlug(input.listingSlug);
      if (!listing || !isPublicRecord(listing)) throw new AppError("booking");
      if (!isCitySlug(input.preferredCity)) throw new AppError("city");
      const guestName = input.guestName.trim();
      const guestEmail = input.guestEmail.trim().toLowerCase();
      const notes = input.notes.trim();
      const preferredDates = input.preferredDates.trim();
      const guestPhone = input.guestPhone.trim();
      if (guestName.length < 2) throw new AppError("name");
      if (!isEmail(guestEmail)) throw new AppError("email");
      if (guestPhone.replace(/\D/g, "").length < 7) throw new AppError("phone");
      if (notes.length < 3) throw new AppError("booking");
      if (preferredDates.length < 2) throw new AppError("booking");
      const artist = artistById(listing.artistId);
      if (!artist) throw new AppError("booking");
      const stamp = nowIso(now);
      const booking: BookingRecord = {
        id: crypto.randomUUID(),
        listingId: listing.id,
        artistId: listing.artistId,
        guestName,
        guestEmail,
        guestPhone,
        preferredCity: input.preferredCity,
        notes: notes.slice(0, 2000),
        preferredDates: preferredDates.slice(0, 200),
        status: "requested",
        proposedTime: null,
        artistNote: null,
        ageAcknowledgedAt: stamp,
        manageToken: randomToken(),
        createdAt: stamp,
        updatedAt: stamp,
      };
      db.bookings.push(booking);
      return { booking, artistEmail: artist.email, artistName: listing.displayName, profileSlug: listing.slug };
    },

    async artistBookings(user, now = at()) {
      const artistId = requireArtist(user);
      return db.bookings
        .filter((booking) => booking.artistId === artistId)
        .map((booking) => touchBooking(booking, now))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async decideBooking(user, bookingId, action: ArtistAction, extra, now = at()): Promise<BookingDecision> {
      const artistId = requireArtist(user);
      const booking = db.bookings.find((item) => item.id === bookingId && item.artistId === artistId);
      if (!booking) throw new AppError("not-found");
      const next = applyArtistAction(booking, action, extra, now);
      Object.assign(booking, next);
      const listing = db.listings.find((item) => item.id === booking.listingId);
      const artist = artistById(artistId);
      return {
        booking,
        guestEmail: booking.guestEmail,
        artistEmail: artist?.email ?? user.email,
        artistName: listing?.displayName ?? "Artist",
        profileSlug: listing?.slug ?? "",
      };
    },

    async bookingByToken(token, now = at()): Promise<GuestBooking | null> {
      const booking = db.bookings.find((item) => item.manageToken === token);
      if (!booking) return null;
      touchBooking(booking, now);
      const listing = db.listings.find((item) => item.id === booking.listingId);
      if (!listing) return null;
      return {
        booking,
        artistName: listing.displayName,
        profileSlug: listing.slug,
        citySlug: listing.citySlug,
        publicProfile: isPublicRecord(listing),
      };
    },

    async cancelByToken(token, now = at()): Promise<BookingDecision> {
      const booking = db.bookings.find((item) => item.manageToken === token);
      if (!booking) throw new AppError("not-found");
      const next = applyGuestCancel(booking, now);
      Object.assign(booking, next);
      const listing = db.listings.find((item) => item.id === booking.listingId);
      const artist = listing ? artistById(listing.artistId) : undefined;
      return {
        booking,
        guestEmail: booking.guestEmail,
        artistEmail: artist?.email ?? "",
        artistName: listing?.displayName ?? "Artist",
        profileSlug: listing?.slug ?? "",
      };
    },

    async moderationQueue(): Promise<ModerationQueue> {
      const listings = db.listings
        .filter((listing) => listing.moderationStatus !== "removed")
        .map((listing) => ({
          ...listing,
          email: artistById(listing.artistId)?.email ?? "",
          imageCount: db.images.filter((image) => image.listingId === listing.id).length,
        }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const images = db.images
        .filter((image) => image.moderationStatus !== "removed")
        .map((image) => {
          const listing = db.listings.find((item) => item.id === image.listingId);
          return {
            ...image,
            artistName: listing?.displayName ?? "Artist",
            listingSlug: listing?.slug ?? "",
          };
        });
      return { listings, images, reports: db.reports.filter((report) => !report.resolvedAt) };
    },

    async moderateListing(listingId, action: ModerateAction, now = at()) {
      const listing = db.listings.find((item) => item.id === listingId);
      if (!listing) throw new AppError("not-found");
      const status = nextModeration(action);
      listing.moderationStatus = status;
      listing.updatedAt = nowIso(now);
      if (status === "approved") {
        for (const image of db.images) {
          if (image.listingId === listing.id && image.moderationStatus === "pending") {
            image.moderationStatus = "approved";
          }
        }
      }
    },

    async moderateImage(imageId, action: ModerateAction) {
      const image = db.images.find((item) => item.id === imageId);
      if (!image) throw new AppError("not-found");
      image.moderationStatus = nextModeration(action);
    },

    async setFeatured(listingId, featured, now = at()) {
      const listing = db.listings.find((item) => item.id === listingId);
      if (!listing) throw new AppError("not-found");
      listing.featured = featured;
      listing.featuredUntil = null;
      listing.updatedAt = nowIso(now);
    },

    async createReport(input, now = at()) {
      const listing = listingBySlug(input.slug);
      if (!listing || !isPublicRecord(listing)) throw new AppError("not-found");
      const reason = input.reason.trim();
      if (reason.length < 10 || reason.length > 2000) throw new AppError("report");
      const email = input.email.trim().toLowerCase();
      if (email && !isEmail(email)) throw new AppError("email");
      db.reports.push({
        id: crypto.randomUUID(),
        listingId: listing.id,
        listingSlug: listing.slug,
        artistName: listing.displayName,
        reporterEmail: email,
        reason,
        createdAt: nowIso(now),
        resolvedAt: null,
      });
    },

    async resolveReport(id, now = at()) {
      const report = db.reports.find((item) => item.id === id);
      if (!report) throw new AppError("not-found");
      report.resolvedAt = nowIso(now);
    },

    async logEmail(email: StoredEmail) {
      db.emails.unshift(email);
      db.emails.splice(50);
    },

    async listEmails() {
      return db.emails;
    },
  };
}
