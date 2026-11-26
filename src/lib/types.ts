import type { CitySlug } from "./cities";

export type ModerationStatus = "pending" | "approved" | "hidden" | "removed";
export type BookingStatus = "requested" | "confirmed" | "declined" | "cancelled" | "expired";
export type ImageTag = "healed" | "fresh" | "unspecified";
export type ContactPreference = "email" | "phone" | "either";
export type UserRole = "artist" | "admin";
export type ModerateAction = "approve" | "hide" | "remove";
export type ArtistAction = "confirm" | "decline" | "propose" | "cancel";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  artistId: string | null;
}

export interface ListingRecord {
  id: string;
  artistId: string;
  slug: string;
  displayName: string;
  citySlug: CitySlug;
  shopName: string | null;
  bio: string;
  hours: string;
  contactPreference: ContactPreference;
  phone: string | null;
  zip: string | null;
  styleSlugs: string[];
  published: boolean;
  moderationStatus: ModerationStatus;
  featured: boolean;
  featuredUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioImageRecord {
  id: string;
  listingId: string;
  alt: string;
  tag: ImageTag;
  url: string;
  bytes: number;
  moderationStatus: ModerationStatus;
  rightsAcknowledgedAt: string;
  createdAt: string;
}

export interface ArtistRecord {
  id: string;
  userId: string;
  email: string;
  ageAcknowledgedAt: string;
  imageRightsAcknowledgedAt: string;
  createdAt: string;
}

export interface BookingRecord {
  id: string;
  listingId: string;
  artistId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  preferredCity: CitySlug;
  notes: string;
  preferredDates: string;
  status: BookingStatus;
  proposedTime: string | null;
  artistNote: string | null;
  ageAcknowledgedAt: string;
  manageToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportRecord {
  id: string;
  listingId: string;
  listingSlug: string;
  artistName: string;
  reporterEmail: string;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface StoredEmail {
  id: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  createdAt: string;
}

export interface SearchRecord {
  slug: string;
  displayName: string;
  citySlug: CitySlug;
  shopName: string | null;
  bio: string;
  styleSlugs: string[];
  published: boolean;
  moderationStatus: ModerationStatus;
  featured: boolean;
  featuredUntil: string | null;
  updatedAt: string;
  photoUrl: string | null;
  photoAlt: string | null;
}

export interface PublicCard {
  slug: string;
  displayName: string;
  citySlug: CitySlug;
  cityLabel: string;
  shopName: string | null;
  styles: { slug: string; name: string }[];
  featured: boolean;
  photoUrl: string | null;
  photoAlt: string | null;
}

export type SearchOutcome =
  | { kind: "picker" }
  | { kind: "blocked"; place: string }
  | {
      kind: "results";
      city: CitySlug | null;
      styleName: string | null;
      text: string | null;
      results: PublicCard[];
    };

export interface PublicProfile {
  listing: ListingRecord;
  images: PortfolioImageRecord[];
  cityLabel: string;
  styles: { slug: string; name: string }[];
  featured: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  user: SessionUser;
  tokens: AuthTokens | null;
  /** Supabase sign-up is waiting on the address confirmation link. */
  confirmEmail?: boolean;
}

export interface ListingInput {
  displayName: string;
  citySlug: CitySlug;
  shopName: string;
  bio: string;
  hours: string;
  contactPreference: ContactPreference;
  phone: string;
  zip: string;
  styleSlugs: string[];
  published: boolean;
}

export interface SignupInput {
  email: string;
  password: string;
  age: boolean;
  imageRights: boolean;
}

export interface NewImageInput {
  bytes: Uint8Array;
  alt: string;
  tag: ImageTag;
  rights: boolean;
}

export interface BookingInput {
  listingSlug: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  preferredCity: CitySlug;
  notes: string;
  preferredDates: string;
  age: boolean;
}

export interface BookingCreated {
  booking: BookingRecord;
  artistEmail: string;
  artistName: string;
  profileSlug: string;
}

export interface BookingDecision {
  booking: BookingRecord;
  guestEmail: string;
  artistEmail: string;
  artistName: string;
  profileSlug: string;
}

export interface GuestBooking {
  booking: BookingRecord;
  artistName: string;
  profileSlug: string;
  citySlug: CitySlug;
  publicProfile: boolean;
}

export interface DashboardData {
  email: string;
  listing: ListingRecord | null;
  images: PortfolioImageRecord[];
  requestedCount: number;
}

export interface QueueListing extends ListingRecord {
  email: string;
  imageCount: number;
}

export interface QueueImage extends PortfolioImageRecord {
  artistName: string;
  listingSlug: string;
}

export interface ModerationQueue {
  listings: QueueListing[];
  images: QueueImage[];
  reports: ReportRecord[];
}

export interface DataRepository {
  readonly mode: "demo" | "supabase";
  search(input: { q?: string | null; city?: string | null; style?: string | null }, now?: Date): Promise<SearchOutcome>;
  cityListings(city: CitySlug, now?: Date): Promise<PublicCard[]>;
  publicProfile(slug: string, now?: Date): Promise<PublicProfile | null>;
  signup(input: SignupInput): Promise<LoginResult>;
  login(email: string, password: string): Promise<LoginResult | null>;
  userFromAccessToken(accessToken: string): Promise<SessionUser | null>;
  refresh(refreshToken: string): Promise<LoginResult | null>;
  dashboard(user: SessionUser, now?: Date): Promise<DashboardData>;
  saveListing(user: SessionUser, input: ListingInput): Promise<ListingRecord>;
  addImage(user: SessionUser, input: NewImageInput): Promise<PortfolioImageRecord>;
  deleteImage(user: SessionUser, imageId: string): Promise<void>;
  createBooking(input: BookingInput, now?: Date): Promise<BookingCreated>;
  artistBookings(user: SessionUser, now?: Date): Promise<BookingRecord[]>;
  decideBooking(
    user: SessionUser,
    bookingId: string,
    action: ArtistAction,
    extra: { proposedTime?: string; note?: string },
    now?: Date,
  ): Promise<BookingDecision>;
  bookingByToken(token: string, now?: Date): Promise<GuestBooking | null>;
  cancelByToken(token: string, now?: Date): Promise<BookingDecision>;
  moderationQueue(now?: Date): Promise<ModerationQueue>;
  moderateListing(listingId: string, action: ModerateAction, now?: Date): Promise<void>;
  moderateImage(imageId: string, action: ModerateAction, now?: Date): Promise<void>;
  setFeatured(listingId: string, featured: boolean, now?: Date): Promise<void>;
  createReport(input: { slug: string; email: string; reason: string }, now?: Date): Promise<void>;
  resolveReport(id: string, now?: Date): Promise<void>;
  logEmail(email: StoredEmail): Promise<void>;
  listEmails(): Promise<StoredEmail[]>;
}
