import { resolveSiteUrl } from "../config/site";
import { cityLabel, isCitySlug, type CitySlug } from "./cities";
import { applyArtistAction, applyGuestCancel, expireBooking } from "./booking";
import { AppError } from "./errors";
import { validateImageMeta, validatePortfolioUpload } from "./images";
import {
  isEmail,
  nextModeration,
  sameStyleSet,
  requireAcknowledgements,
  requireBookingAge,
  slugifyName,
  uniqueSlug,
  validateListingInput,
  validatePassword,
} from "./listing";
import { isFeaturedActive, isPublicRecord, queryRecords, runSearch } from "./search";
import { styleBySlug } from "./styles";
import { createSupabase } from "./supabase";
import type {
  ArtistAction,
  BookingDecision,
  BookingInput,
  BookingRecord,
  BookingStatus,
  ContactPreference,
  DashboardData,
  DataRepository,
  GuestBooking,
  ImageTag,
  ListingInput,
  ListingRecord,
  LoginResult,
  ModerateAction,
  ModerationStatus,
  NewImageInput,
  PortfolioImageRecord,
  PublicProfile,
  SearchRecord,
  SessionUser,
  SignupInput,
} from "./types";
import { randomToken } from "./auth/webcrypto";

interface ImageRow {
  id: string;
  alt_text: string;
  tag: ImageTag;
  storage_path: string;
  byte_size: number;
  moderation_status: ModerationStatus;
  rights_acknowledged_at: string;
  created_at: string;
}

interface ListingRow {
  id: string;
  artist_id: string;
  slug: string;
  display_name: string;
  city_slug: string;
  shop_name: string | null;
  bio: string;
  hours: string;
  contact_preference: ContactPreference;
  phone: string | null;
  zip: string | null;
  published: boolean;
  moderation_status: ModerationStatus;
  featured: boolean;
  featured_until: string | null;
  created_at: string;
  updated_at: string;
  listing_styles?: { style_slug: string }[] | null;
  portfolio_images?: ImageRow[] | null;
}

const LISTING_COLUMNS = `
  id, artist_id, slug, display_name, city_slug, shop_name, bio, hours, contact_preference, phone, zip,
  published, moderation_status, featured, featured_until, created_at, updated_at,
  listing_styles ( style_slug ),
  portfolio_images ( id, alt_text, tag, storage_path, byte_size, moderation_status, rights_acknowledged_at, created_at )
`;

function required<T>(value: T | null | undefined, code = "server"): T {
  if (value == null) throw new AppError(code);
  return value;
}

function dbError(error: { message: string } | null, code = "server"): void {
  if (!error) return;
  const message = error.message.toLowerCase();
  if (message.includes("already") || message.includes("registered") || message.includes("duplicate")) {
    throw new AppError("email-taken");
  }
  if (message.includes("invalid booking") || message.includes("cannot")) throw new AppError("status");
  console.error(error.message);
  throw new AppError(code);
}

export function createSupabaseRepository(
  config: { url: string; anonKey: string; serviceRoleKey: string },
  accessToken: string | null,
): DataRepository {
  const service = createSupabase(config.url, config.serviceRoleKey);
  const anon = () => createSupabase(config.url, config.anonKey);
  const userClient = () => {
    if (!accessToken) throw new AppError("auth");
    return createSupabase(config.url, config.anonKey, accessToken);
  };

  async function signedUrl(path: string): Promise<string> {
    const signed = await service.storage.from("portfolio").createSignedUrl(path, 600);
    if (signed.error || !signed.data?.signedUrl) return "";
    return signed.data.signedUrl;
  }

  async function mapImage(row: ImageRow, sign: boolean): Promise<PortfolioImageRecord> {
    const url = sign && row.storage_path ? await signedUrl(row.storage_path) : "";
    return {
      id: row.id,
      listingId: "",
      alt: row.alt_text,
      tag: row.tag,
      url,
      bytes: row.byte_size,
      moderationStatus: row.moderation_status,
      rightsAcknowledgedAt: row.rights_acknowledged_at,
      createdAt: row.created_at,
    };
  }

  function mapListing(row: ListingRow): ListingRecord | null {
    if (!isCitySlug(row.city_slug)) return null;
    return {
      id: row.id,
      artistId: row.artist_id,
      slug: row.slug,
      displayName: row.display_name,
      citySlug: row.city_slug,
      shopName: row.shop_name,
      bio: row.bio,
      hours: row.hours,
      contactPreference: row.contact_preference,
      phone: row.phone,
      zip: row.zip,
      styleSlugs: (row.listing_styles ?? []).map((style) => style.style_slug),
      published: row.published,
      moderationStatus: row.moderation_status,
      featured: row.featured,
      featuredUntil: row.featured_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async function toSearchRecord(row: ListingRow): Promise<SearchRecord | null> {
    const listing = mapListing(row);
    if (!listing) return null;
    const photo = (row.portfolio_images ?? [])
      .filter((image) => image.moderation_status === "approved")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
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
      photoUrl: photo ? await signedUrl(photo.storage_path) : null,
      photoAlt: photo?.alt_text ?? null,
    };
  }

  async function loadRows(): Promise<ListingRow[]> {
    const { data, error } = await anon().from("listings").select(LISTING_COLUMNS);
    dbError(error);
    return (data ?? []) as ListingRow[];
  }

  async function profileFor(token: string, userId: string, email: string): Promise<SessionUser | null> {
    const client = createSupabase(config.url, config.anonKey, token);
    const { data: roles, error } = await client.from("user_roles").select("role").eq("user_id", userId);
    dbError(error);
    const names = ((roles ?? []) as { role: string }[]).map((row) => row.role);
    const role = names.includes("admin") ? "admin" : names.includes("artist") ? "artist" : null;
    if (!role) return null;
    const { data: artist, error: artistError } = await client.from("artists").select("id").eq("user_id", userId).maybeSingle();
    dbError(artistError);
    return { id: userId, email, role, artistId: (artist?.id as string | undefined) ?? null };
  }

  async function ownListing(user: SessionUser): Promise<ListingRow | null> {
    if (!user.artistId) return null;
    const { data, error } = await userClient()
      .from("listings")
      .select(LISTING_COLUMNS)
      .eq("artist_id", user.artistId)
      .maybeSingle();
    dbError(error);
    return (data as ListingRow | null) ?? null;
  }

  function bookingFromRow(row: Record<string, unknown>): BookingRecord {
    return {
      id: String(row.id),
      listingId: String(row.listing_id),
      artistId: String(row.artist_id),
      guestName: String(row.guest_name),
      guestEmail: String(row.guest_email),
      guestPhone: String(row.guest_phone),
      preferredCity: row.preferred_city as CitySlug,
      notes: String(row.notes),
      preferredDates: String(row.preferred_dates),
      status: row.status as BookingStatus,
      proposedTime: (row.proposed_time as string | null) ?? null,
      artistNote: (row.artist_note as string | null) ?? null,
      ageAcknowledgedAt: String(row.age_acknowledged_at),
      manageToken: String(row.manage_token),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  return {
    mode: "supabase",

    async search(input, now) {
      const rows = await loadRows();
      const records = (await Promise.all(rows.map((row) => toSearchRecord(row)))).filter((row): row is SearchRecord => row !== null);
      return runSearch(records, input, now);
    },

    async cityListings(city, now) {
      const rows = await loadRows();
      const records = (await Promise.all(rows.map((row) => toSearchRecord(row)))).filter((row): row is SearchRecord => row !== null);
      return queryRecords(records, { city, styleSlug: null, text: null }, now ?? new Date());
    },

    async publicProfile(slug, now): Promise<PublicProfile | null> {
      const { data, error } = await anon().from("listings").select(LISTING_COLUMNS).eq("slug", slug).maybeSingle();
      dbError(error);
      if (!data) return null;
      const row = data as ListingRow;
      const listing = mapListing(row);
      if (!listing || !isPublicRecord(listing)) return null;
      const images = await Promise.all(
        (row.portfolio_images ?? [])
          .filter((image) => image.moderation_status === "approved")
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map(async (image) => ({ ...(await mapImage(image, true)), listingId: listing.id })),
      );
      return {
        listing,
        images,
        cityLabel: cityLabel(listing.citySlug),
        styles: listing.styleSlugs.map((style) => ({ slug: style, name: styleBySlug(style)?.name ?? style })),
        featured: isFeaturedActive(listing, now ?? new Date()),
      };
    },

    async signup(input: SignupInput): Promise<LoginResult> {
      requireAcknowledgements(input);
      const email = input.email.trim().toLowerCase();
      if (!isEmail(email)) throw new AppError("email");
      validatePassword(input.password);
      const created = await anon().auth.signUp({
        email,
        password: input.password,
        options: { emailRedirectTo: `${resolveSiteUrl({ PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL })}/artist/login` },
      });
      dbError(created.error);
      const userId = created.data.user?.id;
      if (!userId) throw new AppError("server");
      const stamp = new Date().toISOString();
      const roleInsert = await service.from("user_roles").insert({ user_id: userId, role: "artist" });
      dbError(roleInsert.error);
      const artistInsert = await service.from("artists").insert({
        user_id: userId,
        email,
        age_acknowledged_at: stamp,
        image_rights_acknowledged_at: stamp,
      }).select("id").single();
      dbError(artistInsert.error);
      const artistId = String(required(artistInsert.data).id);
      const session = created.data.session;
      if (!session) {
        return { user: { id: userId, email, role: "artist", artistId }, tokens: null, confirmEmail: true };
      }
      return {
        user: { id: userId, email, role: "artist", artistId },
        tokens: { accessToken: session.access_token, refreshToken: session.refresh_token },
      };
    },

    async login(email, password): Promise<LoginResult | null> {
      const signed = await anon().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (signed.error || !signed.data.session || !signed.data.user?.email) return null;
      const user = await profileFor(signed.data.session.access_token, signed.data.user.id, signed.data.user.email);
      if (!user) return null;
      return {
        user,
        tokens: { accessToken: signed.data.session.access_token, refreshToken: signed.data.session.refresh_token },
      };
    },

    async userFromAccessToken(token) {
      const checked = await anon().auth.getUser(token);
      if (checked.error || !checked.data.user?.email) return null;
      return profileFor(token, checked.data.user.id, checked.data.user.email);
    },

    async refresh(refreshToken) {
      const refreshed = await anon().auth.refreshSession({ refresh_token: refreshToken });
      if (refreshed.error || !refreshed.data.session?.user?.email) return null;
      const session = refreshed.data.session;
      const user = await profileFor(session.access_token, session.user.id, session.user.email ?? "");
      if (!user) return null;
      return { user, tokens: { accessToken: session.access_token, refreshToken: session.refresh_token } };
    },

    async dashboard(user): Promise<DashboardData> {
      const row = await ownListing(user);
      const listing = row ? mapListing(row) : null;
      const images = row
        ? await Promise.all(
          (row.portfolio_images ?? [])
            .filter((image) => image.moderation_status !== "removed")
            .map(async (image) => ({
              ...(await mapImage(image, image.moderation_status === "approved")),
              listingId: row.id,
            })),
        )
        : [];
      let requestedCount = 0;
      if (user.artistId) {
        const { count, error } = await userClient()
          .from("booking_requests")
          .select("id", { count: "exact", head: true })
          .eq("artist_id", user.artistId)
          .eq("status", "requested");
        dbError(error);
        requestedCount = count ?? 0;
      }
      return { email: user.email, listing, images, requestedCount };
    },

    async saveListing(user, input: ListingInput): Promise<ListingRecord> {
      if (user.role !== "artist" || !user.artistId) throw new AppError("forbidden");
      const value = validateListingInput(input);
      const existing = await ownListing(user);
      const client = userClient();
      const stamp = new Date().toISOString();
      const fields = {
        display_name: value.displayName,
        city_slug: value.citySlug,
        shop_name: value.shopName || null,
        bio: value.bio,
        hours: value.hours,
        contact_preference: value.contactPreference,
        phone: value.phone || null,
        zip: value.zip || null,
        published: value.published,
        updated_at: stamp,
      };
      let listingId = existing?.id;
      if (!existing) {
        const { data: slugs, error: slugError } = await client.from("listings").select("slug");
        dbError(slugError);
        const taken = new Set(((slugs ?? []) as { slug: string }[]).map((row) => row.slug));
        const inserted = await client.from("listings").insert({
          ...fields,
          artist_id: user.artistId,
          slug: uniqueSlug(slugifyName(value.displayName), (slug) => taken.has(slug)),
          moderation_status: "pending",
          featured: false,
        }).select("id").single();
        dbError(inserted.error);
        listingId = String(required(inserted.data).id);
      } else {
        const updated = await client.from("listings").update(fields).eq("id", existing.id);
        dbError(updated.error);
      }
      if (!listingId) throw new AppError("server");
      const currentStyles = (existing?.listing_styles ?? []).map((style) => style.style_slug);
      if (!existing || !sameStyleSet(currentStyles, value.styleSlugs)) {
        const cleared = await client.from("listing_styles").delete().eq("listing_id", listingId);
        dbError(cleared.error);
        if (value.styleSlugs.length) {
          const styled = await client.from("listing_styles").insert(
            value.styleSlugs.map((style) => ({ listing_id: listingId, style_slug: style })),
          );
          dbError(styled.error);
        }
      }
      const fresh = await ownListing(user);
      const mapped = fresh ? mapListing(fresh) : null;
      if (!mapped) throw new AppError("server");
      return mapped;
    },

    async addImage(user, input: NewImageInput) {
      if (!user.artistId) throw new AppError("forbidden");
      const listing = await ownListing(user);
      if (!listing) throw new AppError("not-found");
      const meta = validateImageMeta(input);
      const existing = (listing.portfolio_images ?? []).filter((image) => image.moderation_status !== "removed").length;
      validatePortfolioUpload(input.bytes, existing);
      const imageId = crypto.randomUUID();
      const path = `${user.id}/${imageId}.webp`;
      const fileBuffer = new ArrayBuffer(input.bytes.byteLength);
      new Uint8Array(fileBuffer).set(input.bytes);
      const uploaded = await service.storage.from("portfolio").upload(path, new Blob([fileBuffer], { type: "image/webp" }), {
        contentType: "image/webp",
        upsert: false,
      });
      dbError(uploaded.error, "image");
      const inserted = await userClient().from("portfolio_images").insert({
        id: imageId,
        listing_id: listing.id,
        storage_path: path,
        alt_text: meta.alt,
        tag: input.tag,
        byte_size: input.bytes.byteLength,
        moderation_status: "pending",
        rights_acknowledged_at: new Date().toISOString(),
      }).select("id, alt_text, tag, storage_path, byte_size, moderation_status, rights_acknowledged_at, created_at").single();
      if (inserted.error) {
        await service.storage.from("portfolio").remove([path]);
        dbError(inserted.error, "image");
      }
      return { ...(await mapImage(inserted.data as ImageRow, false)), listingId: listing.id };
    },

    async deleteImage(user, imageId) {
      const listing = await ownListing(user);
      const image = listing?.portfolio_images?.find((item) => item.id === imageId);
      if (!listing || !image) throw new AppError("not-found");
      const removed = await userClient().from("portfolio_images").delete().eq("id", imageId);
      dbError(removed.error);
      const stored = await service.storage.from("portfolio").remove([image.storage_path]);
      dbError(stored.error, "image");
    },

    async createBooking(input: BookingInput) {
      requireBookingAge(input.age);
      const { data, error } = await anon().from("listings").select(LISTING_COLUMNS).eq("slug", input.listingSlug).maybeSingle();
      dbError(error);
      const listing = data ? mapListing(data as ListingRow) : null;
      if (!listing || !isPublicRecord(listing)) throw new AppError("booking");
      if (!isCitySlug(input.preferredCity)) throw new AppError("city");
      const guestName = input.guestName.trim();
      const guestEmail = input.guestEmail.trim().toLowerCase();
      if (guestName.length < 2) throw new AppError("name");
      if (!isEmail(guestEmail)) throw new AppError("email");
      if (input.guestPhone.replace(/\D/g, "").length < 7) throw new AppError("phone");
      if (input.notes.trim().length < 3 || input.preferredDates.trim().length < 2) throw new AppError("booking");
      const artist = await service.from("artists").select("email").eq("id", listing.artistId).single();
      dbError(artist.error);
      const token = randomToken();
      const inserted = await service.from("booking_requests").insert({
        listing_id: listing.id,
        artist_id: listing.artistId,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: input.guestPhone.trim(),
        preferred_city: input.preferredCity,
        notes: input.notes.trim().slice(0, 2000),
        preferred_dates: input.preferredDates.trim().slice(0, 200),
        status: "requested",
        age_acknowledged_at: new Date().toISOString(),
        manage_token: token,
      }).select("*").single();
      dbError(inserted.error);
      return {
        booking: bookingFromRow(inserted.data as Record<string, unknown>),
        artistEmail: String(required(artist.data).email),
        artistName: listing.displayName,
        profileSlug: listing.slug,
      };
    },

    async artistBookings(user, now = new Date()) {
      if (!user.artistId) throw new AppError("forbidden");
      const { data, error } = await userClient().from("booking_requests").select("*").eq("artist_id", user.artistId);
      dbError(error);
      const bookings = ((data ?? []) as Record<string, unknown>[]).map(bookingFromRow);
      for (const booking of bookings) {
        const next = expireBooking(booking, now);
        if (next.status !== booking.status) {
          await userClient().from("booking_requests").update({ status: "expired", updated_at: next.updatedAt }).eq("id", booking.id);
          booking.status = "expired";
          booking.updatedAt = next.updatedAt;
        }
      }
      return bookings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async decideBooking(user, bookingId, action: ArtistAction, extra, now = new Date()): Promise<BookingDecision> {
      if (!user.artistId) throw new AppError("forbidden");
      const { data, error } = await userClient().from("booking_requests").select("*").eq("id", bookingId).eq("artist_id", user.artistId).maybeSingle();
      dbError(error);
      if (!data) throw new AppError("not-found");
      const current = bookingFromRow(data as Record<string, unknown>);
      const next = applyArtistAction(current, action, extra, now);
      const updated = await userClient().from("booking_requests").update({
        status: next.status,
        proposed_time: next.proposedTime,
        artist_note: next.artistNote,
        updated_at: next.updatedAt,
      }).eq("id", bookingId);
      dbError(updated.error);
      const listing = await service.from("listings").select("display_name, slug").eq("id", current.listingId).single();
      dbError(listing.error);
      const listingRow = required(listing.data);
      return {
        booking: next,
        guestEmail: next.guestEmail,
        artistEmail: user.email,
        artistName: String(listingRow.display_name),
        profileSlug: String(listingRow.slug),
      };
    },

    async bookingByToken(token, now = new Date()): Promise<GuestBooking | null> {
      const { data, error } = await service.from("booking_requests").select("*").eq("manage_token", token).maybeSingle();
      dbError(error);
      if (!data) return null;
      const booking = bookingFromRow(data as Record<string, unknown>);
      const expired = expireBooking(booking, now);
      if (expired.status !== booking.status) {
        await service.from("booking_requests").update({ status: "expired", updated_at: expired.updatedAt }).eq("id", booking.id);
        booking.status = "expired";
        booking.updatedAt = expired.updatedAt;
      }
      const listing = await service.from("listings").select("display_name, slug, city_slug, published, moderation_status").eq("id", booking.listingId).single();
      dbError(listing.error);
      const row = required(listing.data);
      const citySlug = isCitySlug(String(row.city_slug)) ? row.city_slug : booking.preferredCity;
      return {
        booking,
        artistName: String(row.display_name),
        profileSlug: String(row.slug),
        citySlug,
        publicProfile: Boolean(row.published) && row.moderation_status === "approved",
      };
    },

    async cancelByToken(token, now = new Date()): Promise<BookingDecision> {
      const found = await service.from("booking_requests").select("*").eq("manage_token", token).maybeSingle();
      dbError(found.error);
      if (!found.data) throw new AppError("not-found");
      const current = bookingFromRow(found.data as Record<string, unknown>);
      const next = applyGuestCancel(current, now);
      const updated = await service.from("booking_requests").update({
        status: next.status,
        updated_at: next.updatedAt,
      }).eq("id", current.id);
      dbError(updated.error);
      const listing = await service.from("listings").select("display_name, slug, artist_id").eq("id", current.listingId).single();
      dbError(listing.error);
      const listingRow = required(listing.data);
      const artist = await service.from("artists").select("email").eq("id", String(listingRow.artist_id)).single();
      dbError(artist.error);
      return {
        booking: next,
        guestEmail: next.guestEmail,
        artistEmail: String(required(artist.data).email),
        artistName: String(listingRow.display_name),
        profileSlug: String(listingRow.slug),
      };
    },

    async moderationQueue() {
      const client = userClient();
      const { data: listingRows, error } = await client.from("listings").select(`
        id, artist_id, slug, display_name, city_slug, shop_name, bio, hours, contact_preference, phone, zip,
        published, moderation_status, featured, featured_until, created_at, updated_at,
        listing_styles ( style_slug )
      `);
      dbError(error);
      const listings = [];
      for (const row of (listingRows ?? []) as ListingRow[]) {
        const listing = mapListing(row);
        if (!listing || listing.moderationStatus === "removed") continue;
        const artist = await service.from("artists").select("email").eq("id", listing.artistId).maybeSingle();
        const images = await service.from("portfolio_images").select("id", { count: "exact", head: true }).eq("listing_id", listing.id);
        listings.push({ ...listing, email: String(artist.data?.email ?? ""), imageCount: images.count ?? 0 });
      }
      const { data: imageRows, error: imageError } = await client.from("portfolio_images").select(`
        id, listing_id, alt_text, tag, storage_path, byte_size, moderation_status, rights_acknowledged_at, created_at,
        listings ( display_name, slug )
      `);
      dbError(imageError);
      const images = await Promise.all(
        ((imageRows ?? []) as Array<ImageRow & { listing_id: string; listings?: { display_name: string; slug: string } | { display_name: string; slug: string }[] | null }>)
          .filter((row) => row.moderation_status !== "removed")
          .map(async (row) => {
            const parent = Array.isArray(row.listings) ? row.listings[0] : row.listings;
            return {
              ...(await mapImage(row, row.moderation_status === "approved")),
              listingId: row.listing_id,
              artistName: parent?.display_name ?? "Artist",
              listingSlug: parent?.slug ?? "",
            };
          }),
      );
      const { data: reports, error: reportError } = await client.from("reports").select("*").is("resolved_at", null);
      dbError(reportError);
      return {
        listings,
        images,
        reports: ((reports ?? []) as Record<string, unknown>[]).map((row) => ({
          id: String(row.id),
          listingId: String(row.listing_id),
          listingSlug: String(row.listing_slug),
          artistName: String(row.artist_name),
          reporterEmail: String(row.reporter_email ?? ""),
          reason: String(row.reason),
          createdAt: String(row.created_at),
          resolvedAt: (row.resolved_at as string | null) ?? null,
        })),
      };
    },

    async moderateListing(listingId, action: ModerateAction, now = new Date()) {
      const status = nextModeration(action);
      const updated = await userClient().from("listings").update({
        moderation_status: status,
        updated_at: now.toISOString(),
      }).eq("id", listingId);
      dbError(updated.error);
      if (status === "approved") {
        const images = await userClient()
          .from("portfolio_images")
          .update({ moderation_status: "approved" })
          .eq("listing_id", listingId)
          .eq("moderation_status", "pending");
        dbError(images.error);
      }
      if (status === "removed") {
        const files = await service.from("portfolio_images").select("storage_path").eq("listing_id", listingId);
        dbError(files.error);
        const paths = ((files.data ?? []) as { storage_path: string }[]).map((row) => row.storage_path).filter(Boolean);
        if (paths.length) {
          const removed = await service.storage.from("portfolio").remove(paths);
          dbError(removed.error, "image");
        }
      }
    },

    async moderateImage(imageId, action) {
      const status = nextModeration(action);
      const existing = await service.from("portfolio_images").select("storage_path").eq("id", imageId).maybeSingle();
      dbError(existing.error);
      const updated = await userClient().from("portfolio_images").update({
        moderation_status: status,
      }).eq("id", imageId);
      dbError(updated.error);
      if (status === "removed" && existing.data?.storage_path) {
        const removed = await service.storage.from("portfolio").remove([String(existing.data.storage_path)]);
        dbError(removed.error, "image");
      }
    },

    async setFeatured(listingId, featured, now = new Date()) {
      const updated = await userClient().from("listings").update({
        featured,
        featured_until: null,
        updated_at: now.toISOString(),
      }).eq("id", listingId);
      dbError(updated.error);
    },

    async createReport(input, now = new Date()) {
      const { data, error } = await anon().from("listings").select("id, slug, display_name, published, moderation_status").eq("slug", input.slug).maybeSingle();
      dbError(error);
      if (!data || !data.published || data.moderation_status !== "approved") throw new AppError("not-found");
      const reason = input.reason.trim();
      if (reason.length < 10) throw new AppError("report");
      const email = input.email.trim().toLowerCase();
      if (email && !isEmail(email)) throw new AppError("email");
      const inserted = await service.from("reports").insert({
        listing_id: data.id,
        listing_slug: data.slug,
        artist_name: data.display_name,
        reporter_email: email,
        reason: reason.slice(0, 2000),
        created_at: now.toISOString(),
      });
      dbError(inserted.error);
    },

    async resolveReport(id, now = new Date()) {
      const updated = await userClient().from("reports").update({ resolved_at: now.toISOString() }).eq("id", id);
      dbError(updated.error);
    },

    async logEmail() {},

    async listEmails() {
      return [];
    },
  };
}
