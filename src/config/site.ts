/**
 * Brand and canonical URL live here on purpose.
 * Both are still open human decisions (issue #1). Change them in this file only.
 * PUBLIC_SITE_URL may override the URL for a preview deploy; it does not fork the brand.
 */
export const siteConfig = {
  brandName: "Poco Loco’s Local Tattoo Artists",
  siteUrl: "https://findlocaltattooartists.com",
  description: "Find tattoo artists in Phoenix, AZ and Fort Walton Beach, FL.",
} as const;

export function resolveSiteUrl(env: { PUBLIC_SITE_URL?: string } = {}): string {
  const raw = env.PUBLIC_SITE_URL?.trim() || siteConfig.siteUrl;
  return raw.replace(/\/$/, "");
}
