# Find Local Tattoo Artists

An artist directory and booking site for two cities: Phoenix, AZ and
Fort Walton Beach, FL. The MVP plan is tracked in issue #1.

## What works today

- An Astro + Tailwind site that builds to static files.
- The home page, with the dark look and the hero image (re-encoded from a
  1 MB PNG to a small WebP at build time).
- A search form that goes to a `/search` page. That page says search is
  coming soon; it no longer 404s.
- A Supabase client in `src/lib/supabase.ts`. It stays off until keys are
  set, so the site builds without them.
- CI on every pull request: type check and build.

## Not built yet

Artist sign-up and listings, portfolio uploads, real search, city pages,
artist profiles, booking requests, moderation, legal pages and deployment.
See issue #1 for the order.

There is no CMS. Decap CMS was dropped: artists will manage their own
listings through Supabase auth instead.

## Run it locally

Needs Node 22.23.4 or newer (see `.nvmrc`).

```bash
git clone https://github.com/humanaios-ui/findlocaltattooartists.git
cd findlocaltattooartists
npm ci
npm run dev       # http://localhost:4321
```

Other commands:

```bash
npm run check     # type check
npm run build     # static site in dist/
npm run preview   # serve dist/ locally
```

## Supabase (optional for now)

Copy `.env.example` to `.env` and fill in the project URL and anon key.
Never commit `.env` and never put the service_role key in it.

## Deployment

Not set up. The canonical host and domain are open decisions in issue #1.
