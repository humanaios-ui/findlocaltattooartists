import type { CitySlug } from "../cities";
import type {
  ArtistRecord,
  BookingRecord,
  ListingRecord,
  PortfolioImageRecord,
  ReportRecord,
  StoredEmail,
} from "../types";
import { hashPassword } from "../auth/webcrypto";
import { DEMO_ADMIN_PASSWORD, DEMO_ARTIST_PASSWORD } from "./passwords";

export interface DemoUser {
  id: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  role: "artist" | "admin";
  artistId: string | null;
}

export interface DemoDatabase {
  users: DemoUser[];
  artists: ArtistRecord[];
  listings: ListingRecord[];
  images: PortfolioImageRecord[];
  bookings: BookingRecord[];
  reports: ReportRecord[];
  emails: StoredEmail[];
}

const ACK = "2026-11-01T15:00:00.000Z";

function swatch(hue: number, label: string): string {
  return `/demo/swatch.svg?h=${hue}&t=${encodeURIComponent(label)}`;
}

interface SeedArtist {
  userId: string;
  artistId: string;
  listingId: string;
  email: string;
  slug: string;
  name: string;
  city: CitySlug;
  shop: string;
  styles: string[];
  bio: string;
  status: ListingRecord["moderationStatus"];
  featured: boolean;
  updatedAt: string;
  zip: string | null;
  phone: string | null;
  contact: ListingRecord["contactPreference"];
  images: { hue: number; label: string; tag: PortfolioImageRecord["tag"]; status: PortfolioImageRecord["moderationStatus"] }[];
}

const ARTISTS: SeedArtist[] = [
  {
    userId: "00000000-0000-4000-8000-000000000001",
    artistId: "00000000-0000-4000-8000-000000000011",
    listingId: "00000000-0000-4000-8000-000000000021",
    email: "rosa@demo.invalid",
    slug: "rosa-navarro",
    name: "Rosa Navarro",
    city: "phoenix",
    shop: "South Mountain Demo Shop",
    styles: ["black-and-grey", "fine-line"],
    bio: "Fictional demo artist for local preview. Not a real person and not taking clients. Black and grey portraits and fine-line botanicals, by appointment, in the Phoenix seed data.",
    status: "approved",
    featured: true,
    updatedAt: "2026-11-20T15:00:00.000Z",
    zip: "85004",
    phone: null,
    contact: "email",
    images: [
      { hue: 350, label: "Black and grey", tag: "healed", status: "approved" },
      { hue: 20, label: "Fine line", tag: "fresh", status: "approved" },
      { hue: 0, label: "Portrait study", tag: "healed", status: "approved" },
      { hue: 30, label: "Botanical", tag: "unspecified", status: "approved" },
    ],
  },
  {
    userId: "00000000-0000-4000-8000-000000000002",
    artistId: "00000000-0000-4000-8000-000000000012",
    listingId: "00000000-0000-4000-8000-000000000022",
    email: "leo@demo.invalid",
    slug: "leo-park",
    name: "Leo Park",
    city: "phoenix",
    shop: "Roosevelt Row Demo Studio",
    styles: ["japanese", "traditional"],
    bio: "Fictional demo artist for local preview. Not a real person and not taking clients. Japanese bodies and traditional flash in the Phoenix seed data, updated more recently than the featured listing.",
    status: "approved",
    featured: false,
    updatedAt: "2026-11-25T15:00:00.000Z",
    zip: "85004",
    phone: null,
    contact: "email",
    images: [
      { hue: 200, label: "Japanese", tag: "healed", status: "approved" },
      { hue: 210, label: "Traditional", tag: "fresh", status: "approved" },
      { hue: 190, label: "Sleeve study", tag: "healed", status: "approved" },
      { hue: 220, label: "Flash sheet", tag: "unspecified", status: "approved" },
    ],
  },
  {
    userId: "00000000-0000-4000-8000-000000000003",
    artistId: "00000000-0000-4000-8000-000000000013",
    listingId: "00000000-0000-4000-8000-000000000023",
    email: "casey@demo.invalid",
    slug: "casey-quinn",
    name: "Casey Quinn",
    city: "phoenix",
    shop: "Demo Shop Pending",
    styles: ["geometric"],
    bio: "Fictional demo artist waiting in the moderation queue. Not a real person. This listing must stay out of search until an operator approves it.",
    status: "pending",
    featured: false,
    updatedAt: "2026-11-26T15:00:00.000Z",
    zip: null,
    phone: null,
    contact: "email",
    images: [
      { hue: 270, label: "Geometric", tag: "fresh", status: "pending" },
      { hue: 280, label: "Pattern", tag: "unspecified", status: "pending" },
    ],
  },
  {
    userId: "00000000-0000-4000-8000-000000000004",
    artistId: "00000000-0000-4000-8000-000000000014",
    listingId: "00000000-0000-4000-8000-000000000024",
    email: "june@demo.invalid",
    slug: "june-calder",
    name: "June Calder",
    city: "fort-walton-beach",
    shop: "Okaloosa Demo Shop",
    styles: ["color-realism", "watercolor"],
    bio: "Fictional demo artist for local preview. Not a real person and not taking clients. Color realism and watercolor in the Fort Walton Beach seed data.",
    status: "approved",
    featured: true,
    updatedAt: "2026-11-18T15:00:00.000Z",
    zip: "32547",
    phone: "555-010-0199",
    contact: "either",
    images: [
      { hue: 160, label: "Color realism", tag: "healed", status: "approved" },
      { hue: 140, label: "Watercolor", tag: "fresh", status: "approved" },
      { hue: 120, label: "Color study", tag: "healed", status: "approved" },
      { hue: 100, label: "Wash", tag: "unspecified", status: "approved" },
    ],
  },
  {
    userId: "00000000-0000-4000-8000-000000000005",
    artistId: "00000000-0000-4000-8000-000000000015",
    listingId: "00000000-0000-4000-8000-000000000025",
    email: "andre@demo.invalid",
    slug: "andre-wells",
    name: "Andre Wells",
    city: "fort-walton-beach",
    shop: "Demo Shop FWB",
    styles: ["blackwork", "ornamental"],
    bio: "Fictional demo artist for local preview. Not a real person and not taking clients. Blackwork and ornamental pieces in the Fort Walton Beach seed data.",
    status: "approved",
    featured: false,
    updatedAt: "2026-11-24T15:00:00.000Z",
    zip: "32548",
    phone: null,
    contact: "email",
    images: [
      { hue: 240, label: "Blackwork", tag: "healed", status: "approved" },
      { hue: 250, label: "Ornamental", tag: "fresh", status: "approved" },
      { hue: 230, label: "Solid black", tag: "healed", status: "approved" },
      { hue: 260, label: "Linework", tag: "unspecified", status: "approved" },
    ],
  },
  {
    userId: "00000000-0000-4000-8000-000000000006",
    artistId: "00000000-0000-4000-8000-000000000016",
    listingId: "00000000-0000-4000-8000-000000000026",
    email: "riley@demo.invalid",
    slug: "riley-cho",
    name: "Riley Cho",
    city: "phoenix",
    shop: "Hidden Demo Shop",
    styles: ["illustrative"],
    bio: "Fictional demo artist whose listing is hidden. Not a real person. This profile must not be public and must not appear in search.",
    status: "hidden",
    featured: false,
    updatedAt: "2026-11-22T15:00:00.000Z",
    zip: null,
    phone: null,
    contact: "email",
    images: [{ hue: 50, label: "Hidden", tag: "healed", status: "hidden" }],
  },
];

export async function buildSeedDatabase(): Promise<DemoDatabase> {
  const artistHash = await hashPassword(DEMO_ARTIST_PASSWORD, "demo-artist-salt");
  const adminHash = await hashPassword(DEMO_ADMIN_PASSWORD, "demo-admin-salt");
  const users: DemoUser[] = ARTISTS.map((artist) => ({
    id: artist.userId,
    email: artist.email,
    passwordSalt: "demo-artist-salt",
    passwordHash: artistHash,
    role: "artist" as const,
    artistId: artist.artistId,
  }));
  users.push({
    id: "00000000-0000-4000-8000-0000000000aa",
    email: "admin@demo.invalid",
    passwordSalt: "demo-admin-salt",
    passwordHash: adminHash,
    role: "admin",
    artistId: null,
  });

  const artists: ArtistRecord[] = ARTISTS.map((artist) => ({
    id: artist.artistId,
    userId: artist.userId,
    email: artist.email,
    ageAcknowledgedAt: ACK,
    imageRightsAcknowledgedAt: ACK,
    createdAt: "2026-11-01T15:00:00.000Z",
  }));

  const listings: ListingRecord[] = ARTISTS.map((artist) => ({
    id: artist.listingId,
    artistId: artist.artistId,
    slug: artist.slug,
    displayName: artist.name,
    citySlug: artist.city,
    shopName: artist.shop,
    bio: artist.bio,
    hours: "By appointment",
    contactPreference: artist.contact,
    phone: artist.phone,
    zip: artist.zip,
    styleSlugs: artist.styles,
    published: true,
    moderationStatus: artist.status,
    featured: artist.featured,
    featuredUntil: null,
    createdAt: "2026-11-01T15:00:00.000Z",
    updatedAt: artist.updatedAt,
  }));

  const images: PortfolioImageRecord[] = ARTISTS.flatMap((artist) =>
    artist.images.map((image, index) => ({
      id: `${artist.listingId}-${index}`,
      listingId: artist.listingId,
      alt: `Demo placeholder, not a real tattoo: ${image.label}`,
      tag: image.tag,
      url: swatch(image.hue, image.label),
      bytes: 1200,
      moderationStatus: image.status,
      rightsAcknowledgedAt: ACK,
      createdAt: `2026-11-0${index + 1}T15:00:00.000Z`,
    })),
  );

  return { users, artists, listings, images, bookings: [], reports: [], emails: [] };
}

export const DEMO_PUBLIC_SLUGS = ["rosa-navarro", "leo-park", "june-calder", "andre-wells"] as const;
