// Alphabetical order for people lists (9 Oct 2026, Riaan: "the student and
// pilot list, can we make it that the order is alphabetic, sort on name").
// SQLite's ORDER BY name is case-sensitive ("Zak" before "andre") and counts
// stray spaces, so lists are sorted here instead: A-Z, ignoring case,
// accents and leading/trailing spaces.
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function compareByName(a: { name: string | null }, b: { name: string | null }): number {
  return collator.compare((a.name ?? "").trim(), (b.name ?? "").trim());
}
