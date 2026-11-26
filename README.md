# Find Local Tattoo Artists

A HumanAIOS-owned marketplace for tattoo artists in two cities: Phoenix, AZ and Fort Walton Beach, FL. Guests request a booking. The artist confirms or declines. Nothing on the site takes payment.

The plan is issue #1. This tree builds on the Astro 7 scaffold from PR #2. The brand line is still “Poco Loco’s Local Tattoo Artists”, and the public URL is still undecided. Both live in `src/config/site.ts`.

## What works

- Astro 7 and Tailwind 4. The home page keeps the dark look. The hero PNG is re-encoded to WebP at build time, with the old “worldwide” line and the fake login buttons painted out of the artwork.
- Search at `/search`, plus `/phoenix` and `/fort-walton-beach`. Results stay inside those two cities. Featured listings sort first. The featured flag is stored, not sold.
- Artist sign-up and one listing. No shop account and no customer account.
- Portfolio upload. The browser compresses the photo to WebP before it is stored. Images can be tagged healed or fresh.
- A public artist page with a Book button. The guest gets a private link. The artist confirms, declines, proposes another time, or cancels.
- Email through a small provider interface: Resend, Postmark, or the console when no key is set. Demo mode also keeps a local inbox.
- A moderation queue for an admin role: pending, approve, hide, remove, plus the featured pin.
- Terms and Privacy. Both are marked DRAFT and need a human legal review.
- Row-level security in `supabase/migrations/`. The app runs without those keys.

There is no CMS. Decap was dropped in PR #2.

## Run the demo

Needs Node 22.23.4 or newer (see `.nvmrc`).

```bash
npm ci
npm run dev       # http://localhost:4321
```

Leave `.env` empty. Under `npm run dev` the site then uses fictional artists. They are not real people and they are not a launch supply. A built server (`npm run build`, any host, including `npm run preview`) refuses that demo unless `FLTA_DEMO=1` is set on purpose.

| Who | Email | Password |
|---|---|---|
| Artist (Phoenix, featured) | rosa@demo.invalid | demo-pass-123 |
| Other seeded artists | leo@, casey@, june@, andre@, riley@demo.invalid | demo-pass-123 |
| Operator | admin@demo.invalid | demo-admin-123 |

Casey Quinn starts pending, so the operator queue has something to approve. Riley Cho is hidden and does not appear in search. The operator login is at `/admin/login` and is not linked from the public footer.

`npm run build` then `npm run preview` serves the same demo. Restarting the process resets it.

## Supabase

Create a project, then run `supabase/migrations/20261126120000_init.sql` in the SQL editor. Copy `.env.example` to `.env` and set:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only — never prefix it with `PUBLIC_` and never commit it)
- `SESSION_SECRET` (at least 16 random characters)

In Authentication, turn off “confirm email” or rely on the server, which creates users with `email_confirm` already set. Create the operator in Authentication, then:

```sql
insert into public.user_roles (user_id, role)
values ('<auth user uuid>', 'admin');
```

Do not load fictional artists into that database. `supabase/seed.sql` intentionally inserts none. The schema is described in `docs/data-model.md`.

For mail, set `EMAIL_FROM` and either `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN`. The from-address has to be verified with that provider. With neither key, messages are logged.

## Scripts

```bash
npm run check     # astro check
npm test          # vitest
npm run build     # node adapter by default
npm run preview
```

## Deployment

Not pointed at a live domain. Cloudflare and Vercel build commands are in `docs/deploy.md`. Set `DEPLOY_TARGET=cloudflare` or `DEPLOY_TARGET=vercel` for those hosts. The default build is a Node server, which is what CI runs. DNS and hosting accounts are unchanged.

## Not in this repo yet

A real Supabase project, email-provider verification, legal review of the draft Terms and Privacy, the canonical domain, the public brand, and the launch supply of real artists (M10 in issue #1). No Stripe, ads, affiliates, Pro tier, or extra cities.
