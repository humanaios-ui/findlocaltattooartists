# Deploy

The canonical domain is not chosen. This file does not change DNS, GitHub Pages, Cloudflare, or Vercel accounts. GitHub Pages is not the host for this app: auth, uploads, and booking requests need a server. Leave GitHub Pages as it is until a human points the chosen domain at a real deploy and, only then, adds a redirect.

`src/config/site.ts` holds the brand name and the default site URL. Set `PUBLIC_SITE_URL` in the host if a preview should use a different origin.

## Build target

`astro.config.mjs` reads `DEPLOY_TARGET`:

| Value | Adapter | When |
|---|---|---|
| `node` (default) | `@astrojs/node` standalone | Local `npm run build` and CI |
| `cloudflare` | `@astrojs/cloudflare` | Cloudflare Workers / Pages |
| `vercel` | `@astrojs/vercel` | Vercel |

Pages are static unless they export `prerender = false`. The home page, terms, and privacy are static. Search, city pages, profiles, artist pages, bookings, and moderation render on each request so a moderator’s decision shows up without another build.

Form posts check that the browser `Origin` host matches the `Host` header. Astro’s built-in origin check is off, because it rewrites the request URL to localhost unless every preview hostname is listed in advance.

Local preview after a node build:

```bash
npm run build
npm run preview
```

## Shared environment

Set these in the host, not in git:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `SESSION_SECRET` (16+ random characters)
- `PUBLIC_SITE_URL` (optional)
- `EMAIL_FROM` plus either `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN`

Apply `supabase/migrations/20261126120000_init.sql` in the Supabase project first. Create the operator in Authentication, then:

```sql
insert into public.user_roles (user_id, role) values ('<auth user uuid>', 'admin');
```

Do not set `FLTA_DEMO=1` on the public host. Without Supabase keys, a non-local host returns a configuration error instead of fictional artists.

## Cloudflare

In the Workers / Pages project:

- Build command: `DEPLOY_TARGET=cloudflare npm run build`
- Node 22
- The same environment variables as above

The adapter compiles images at build time and prerenders static pages with Node, so the hero WebP does not depend on the Cloudflare Images binding. No KV binding is required; this app keeps its own cookies and sets Astro sessions off.

## Vercel

In the Vercel project:

- Build command: `DEPLOY_TARGET=vercel npm run build` (or set `DEPLOY_TARGET=vercel` in the project env and use `npm run build`)
- Node 22
- The same environment variables

Do not add a custom domain from this repo. That stays a human decision in issue #1.
