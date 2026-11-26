export const prerender = false;

import type { APIRoute } from "astro";

export const GET: APIRoute = ({ url, locals }) => {
  if (!locals.demo) return new Response("Not found", { status: 404 });
  const hue = Number(url.searchParams.get("h") ?? "350");
  const safeHue = Number.isFinite(hue) ? Math.max(0, Math.min(360, hue)) : 350;
  const label = (url.searchParams.get("t") ?? "Demo").replace(/[^a-zA-Z0-9 &-]/g, "").slice(0, 32) || "Demo";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
  <rect width="800" height="1000" fill="#070708"/>
  <rect x="48" y="48" width="704" height="904" rx="36" fill="hsl(${safeHue} 28% 16%)" stroke="#9f1239" stroke-width="8"/>
  <text x="400" y="430" text-anchor="middle" fill="#f4f0ea" font-family="Georgia, serif" font-size="72">DEMO</text>
  <text x="400" y="520" text-anchor="middle" fill="#9f1239" font-family="sans-serif" font-size="36">${label}</text>
  <text x="400" y="600" text-anchor="middle" fill="#f4f0ea" font-family="sans-serif" font-size="28" opacity="0.8">Not a real tattoo</text>
</svg>`;
  return new Response(svg, {
    headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400" },
  });
};
