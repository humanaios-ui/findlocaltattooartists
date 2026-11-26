export const STYLES = [
  { slug: "traditional", name: "Traditional" },
  { slug: "neo-traditional", name: "Neo-Traditional" },
  { slug: "black-and-grey", name: "Black & Grey Realism" },
  { slug: "japanese", name: "Japanese" },
  { slug: "fine-line", name: "Fine Line" },
  { slug: "illustrative", name: "Illustrative" },
  { slug: "watercolor", name: "Watercolor" },
  { slug: "blackwork", name: "Blackwork" },
  { slug: "script", name: "Script" },
  { slug: "geometric", name: "Geometric" },
  { slug: "color-realism", name: "Color Realism" },
  { slug: "tribal", name: "Tribal" },
  { slug: "ornamental", name: "Ornamental" },
  { slug: "anime", name: "Anime" },
] as const;

export type StyleSlug = (typeof STYLES)[number]["slug"];

const STYLE_ALIASES: { phrase: string; slug: StyleSlug }[] = [
  { phrase: "black and grey realism", slug: "black-and-grey" },
  { phrase: "black and grey", slug: "black-and-grey" },
  { phrase: "neo traditional", slug: "neo-traditional" },
  { phrase: "color realism", slug: "color-realism" },
  { phrase: "fine line", slug: "fine-line" },
];

export function isStyleSlug(value: string): value is StyleSlug {
  return STYLES.some((style) => style.slug === value);
}

export function styleBySlug(slug: string): (typeof STYLES)[number] | undefined {
  return STYLES.find((style) => style.slug === slug);
}

export function styleName(slug: string): string {
  return styleBySlug(slug)?.name ?? slug;
}

/** Longest phrase first so "neo traditional" does not collapse to Traditional. */
export function stylePhrases(): { phrase: string; slug: StyleSlug }[] {
  const fromNames = STYLES.map((style) => ({
    phrase: normalizePhrase(style.name),
    slug: style.slug,
  }));
  const merged = [...STYLE_ALIASES, ...fromNames];
  const seen = new Set<string>();
  return merged
    .filter((item) => {
      if (seen.has(item.phrase)) return false;
      seen.add(item.phrase);
      return true;
    })
    .sort((a, b) => b.phrase.length - a.phrase.length);
}

export function normalizePhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
