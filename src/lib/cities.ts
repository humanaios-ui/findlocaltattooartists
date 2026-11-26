// The launch-day MVP serves exactly two cities. Everything else is out of
// scope until a human decides otherwise.
export const CITIES = [
  { slug: "phoenix", name: "Phoenix", state: "AZ", stateName: "Arizona" },
  {
    slug: "fort-walton-beach",
    name: "Fort Walton Beach",
    state: "FL",
    stateName: "Florida",
  },
] as const;

export type CitySlug = (typeof CITIES)[number]["slug"];

export type City = (typeof CITIES)[number];

/**
 * ZIP allowlist for the two metros. This is not a complete USPS file.
 * A ZIP is accepted only when it is on this list. Destin, Tucson, and other
 * nearby cities are intentionally absent.
 */
export const PHOENIX_ZIPS = [
  "85003", "85004", "85006", "85007", "85008", "85009",
  "85012", "85013", "85014", "85015", "85016", "85017", "85018", "85019",
  "85020", "85021", "85022", "85023", "85024", "85027", "85028", "85029",
  "85031", "85032", "85033", "85034", "85035", "85037",
  "85040", "85041", "85042", "85043", "85044", "85045", "85048",
  "85050", "85051", "85053", "85054", "85083", "85085", "85086",
  "85201", "85202", "85203", "85204", "85205", "85206", "85207", "85208", "85209", "85210",
  "85212", "85213", "85215",
  "85224", "85225", "85226",
  "85233", "85234",
  "85248", "85249", "85250", "85251", "85254", "85255", "85257", "85258", "85259", "85260", "85266",
  "85281", "85282", "85283", "85284", "85286",
  "85295", "85296", "85297", "85298",
  "85301", "85302", "85303", "85304", "85305", "85306", "85308", "85310",
  "85323", "85338", "85345",
  "85374", "85378", "85379", "85381", "85382", "85383", "85387", "85388",
  "85392", "85395",
] as const;

export const FWB_ZIPS = ["32547", "32548"] as const;

const ZIP_TO_CITY = new Map<string, CitySlug>();
for (const zip of PHOENIX_ZIPS) ZIP_TO_CITY.set(zip, "phoenix");
for (const zip of FWB_ZIPS) ZIP_TO_CITY.set(zip, "fort-walton-beach");

export const CITY_ALIASES: { phrase: string; slug: CitySlug }[] = [
  { phrase: "fort walton beach", slug: "fort-walton-beach" },
  { phrase: "fort walton", slug: "fort-walton-beach" },
  { phrase: "okaloosa", slug: "fort-walton-beach" },
  { phrase: "fwb", slug: "fort-walton-beach" },
  { phrase: "phoenix arizona", slug: "phoenix" },
  { phrase: "phoenix az", slug: "phoenix" },
  { phrase: "scottsdale", slug: "phoenix" },
  { phrase: "chandler", slug: "phoenix" },
  { phrase: "gilbert", slug: "phoenix" },
  { phrase: "glendale", slug: "phoenix" },
  { phrase: "avondale", slug: "phoenix" },
  { phrase: "goodyear", slug: "phoenix" },
  { phrase: "surprise", slug: "phoenix" },
  { phrase: "peoria", slug: "phoenix" },
  { phrase: "tempe", slug: "phoenix" },
  { phrase: "mesa", slug: "phoenix" },
  { phrase: "phoenix", slug: "phoenix" },
  { phrase: "phx", slug: "phoenix" },
];

/** Place names that must never return listings from the two launch cities. */
export const OUTSIDE_PLACES = [
  "los angeles",
  "san diego",
  "san antonio",
  "las vegas",
  "new york",
  "fort lauderdale",
  "mary esther",
  "panama city",
  "oklahoma city",
  "colorado springs",
  "salt lake",
  "pensacola",
  "jacksonville",
  "tallahassee",
  "gainesville",
  "albuquerque",
  "minneapolis",
  "philadelphia",
  "sacramento",
  "crestview",
  "niceville",
  "navarre",
  "flagstaff",
  "sedona",
  "prescott",
  "destin",
  "tucson",
  "orlando",
  "tampa",
  "miami",
  "dallas",
  "austin",
  "houston",
  "seattle",
  "chicago",
  "atlanta",
  "denver",
  "boston",
  "brooklyn",
  "portland",
  "detroit",
  "fresno",
  "charlotte",
  "nashville",
  "memphis",
  "milwaukee",
  "baltimore",
  "honolulu",
  "anchorage",
  "boise",
  "omaha",
  "tulsa",
  "wichita",
  "yuma",
  "kingman",
  "nyc",
];

export function isCitySlug(value: string): value is CitySlug {
  return CITIES.some((city) => city.slug === value);
}

export function cityBySlug(slug: string): City | undefined {
  return CITIES.find((city) => city.slug === slug);
}

export function cityLabel(slug: CitySlug): string {
  const city = cityBySlug(slug);
  return city ? `${city.name}, ${city.state}` : slug;
}

export function cityPath(slug: CitySlug): string {
  return `/${slug}`;
}

export function cityForZip(zip: string): CitySlug | null {
  return ZIP_TO_CITY.get(zip) ?? null;
}

export function allKnownZips(): string[] {
  return [...ZIP_TO_CITY.keys()];
}
