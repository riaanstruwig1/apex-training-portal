/** Batch 105: only internal Hub paths may be used as a post-login "next"
 * (no other sites, no protocol-relative "//" tricks). */
export function safeNext(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  if (!/^\/study\/\d{1,2}$/.test(v)) return null; // shared study-note links only
  return v;
}
