# Data model

Two cities only: Phoenix, AZ and Fort Walton Beach, FL. A listing’s `city_slug` references `cities`, and that table’s primary key is checked to those two slugs. A third city is rejected by the database. A ZIP is stored only when it is in `city_zips` for the same city. The allowlist is the MVP set in `src/lib/cities.ts` and in `supabase/migrations/20261126120000_init.sql`. It is not a complete USPS file.

## Tables

- `artists` — one row per auth user. Records the 18+ acknowledgement and the image-rights acknowledgement. No shop login and no customer account.
- `listings` — one row per artist (`artist_id` is unique). Name, city, optional shop name, bio, hours, contact preference, optional phone and ZIP, publish flag, moderation status, and the featured flag.
- `styles` and `listing_styles` — the style list the search page offers.
- `portfolio_images` — WebP bytes in the `portfolio` storage bucket, alt text, healed / fresh / unspecified, and a separate moderation status. Each upload stores `rights_acknowledged_at`.
- `booking_requests` — guest name, email, phone, preferred city, notes, dates, status (`requested`, `confirmed`, `declined`, `cancelled`, `expired`), optional proposed time, and a private `manage_token`.
- `reports` — a public report on a listing.
- `user_roles` — `artist` or `admin`. Artists cannot insert their own role. An operator is created in the Supabase dashboard and then given `admin` with SQL.

`listings.featured` and `listings.featured_until` are a sort key. Search and city pages put an active featured listing first, then the most recently updated. Nothing in this version sells that pin. There is no payments table.

New listings and new images default to `pending`. A public page or search result requires `published` and `moderation_status = 'approved'`. Hidden and removed listings are not public. Listing approval does not approve portfolio images. Each image requires its own moderator decision after inspection.

Changing a public field on an approved listing (name, bio, city, shop, phone, hours, contact, ZIP, or styles) sets `moderation_status` back to `pending` unless the editor is an admin. The portfolio bucket is private and object writes are server-only. An image object key is bound to its owning auth user and image ID. Public pages receive a 10-minute signed URL only for an approved image on a public listing. The authenticated admin queue uses a private, non-cacheable preview for pending images. Removing an image, or removing the listing, deletes the stored object.

A requested booking older than 14 days becomes `expired` the next time it is read. There is no payment, calendar, or instant book.

## Row-level security

The anon key can read cities, styles, ZIPs, and listings that are published and approved, plus the approved images and styles on those listings. It cannot read bookings, reports, artist emails, or pending rows.

An artist can read their own images and edit their own listing. Image creation/deletion runs through the authorized server after ownership and upload checks; metadata is immutable and only administrators can change image moderation. Triggers reject unauthorized changes to listing moderation, featured, and the booking’s guest fields. Status changes are limited to confirm, decline, cancel, and expire.

Guests do not get a select policy on bookings. Creating a request and opening it by token go through the server with the service role, after the app checks the 18+ acknowledgement. The service role key must never use the `PUBLIC_` prefix.

An admin, determined by `user_roles`, can read the queue and change moderation and the featured flag. The app still checks the session role before those actions.

## Demo mode

With no Supabase keys, the app serves fictional artists from `src/lib/demo/seed.ts` under `npm run dev` only (or with `FLTA_DEMO=1`). That data is not in this SQL file.
