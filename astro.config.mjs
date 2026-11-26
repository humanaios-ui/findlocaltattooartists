// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { siteConfig } from './src/config/site.ts';

const target = process.env.DEPLOY_TARGET ?? 'node';

/** @param {string | undefined} value */
function hostnameOf(value) {
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

// Hosts whose forwarded client IP Astro may trust. Without this, a Node
// process behind a proxy reports the proxy address for every visitor, and
// the booking limit becomes one shared bucket.
const allowedHostnames = [
  hostnameOf(siteConfig.siteUrl),
  hostnameOf(process.env.PUBLIC_SITE_URL),
  'localhost',
  '127.0.0.1',
].filter(Boolean);

/** @param {string} name */
async function adapterFor(name) {
  if (name === 'cloudflare') {
    const { default: cloudflare } = await import('@astrojs/cloudflare');
    return cloudflare({ imageService: 'compile', prerenderEnvironment: 'node' });
  }
  if (name === 'vercel') {
    const { default: vercel } = await import('@astrojs/vercel');
    return vercel();
  }
  if (name !== 'node') {
    throw new Error(`Unknown DEPLOY_TARGET "${name}". Use node, cloudflare, or vercel.`);
  }
  return node({ mode: 'standalone' });
}

// Static pages by default. Auth, search, bookings, and moderation opt out
// with `prerender = false`. DEPLOY_TARGET picks the host adapter (M1).
// Sessions here are our own cookies, so Astro's session driver stays off.
export default defineConfig({
  site: siteConfig.siteUrl,
  output: 'static',
  session: false,
  // Astro's origin check rebuilds the request URL as localhost unless every
  // preview host is listed. Routes compare Origin to the Host header instead.
  security: {
    checkOrigin: false,
    allowedDomains: [...new Set(allowedHostnames)].map((hostname) => ({ hostname })),
  },
  adapter: await adapterFor(target),
  vite: {
    plugins: [tailwindcss()],
  },
});
