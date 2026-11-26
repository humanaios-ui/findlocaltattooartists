// The launch-day MVP serves exactly two cities. Everything else is out of
// scope until a human decides otherwise.
export const CITIES = [
  { slug: 'phoenix', name: 'Phoenix', state: 'AZ' },
  { slug: 'fort-walton-beach', name: 'Fort Walton Beach', state: 'FL' },
] as const;

export type CitySlug = (typeof CITIES)[number]['slug'];
