import type { Actor } from "./types.ts";

// EU + closely-associated European research nations. OpenAlex gives us ISO
// two-letter country codes per institution, so actor assignment becomes a
// lookup instead of a guess. This is the core of the attribution fix.
const EU_CODES = new Set([
  "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR",
  "GB", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "NO",
  "PL", "PT", "RO", "SE", "SI", "SK", // GB/CH/NO grouped with Europe here
]);

export function actorFromCountry(code: string | null | undefined): Actor {
  if (!code) return "other";
  const c = code.toUpperCase();
  if (c === "US") return "us";
  if (c === "CN") return "cn";
  if (EU_CODES.has(c)) return "eu";
  return "other";
}

// A work can list institutions from several countries. We take the modal
// country across all authorships as the work's actor — the plurality of
// institutional weight — and record the tally as evidence. Ties fall to the
// first-author country, which is passed in separately.
export function actorFromCountries(
  countryCodes: string[],
  firstAuthorCode: string | null
): { actor: Actor; evidence: string } {
  if (countryCodes.length === 0) {
    return { actor: "other", evidence: "no institution country on record" };
  }
  const tally = new Map<string, number>();
  for (const c of countryCodes) {
    const up = c.toUpperCase();
    tally.set(up, (tally.get(up) ?? 0) + 1);
  }
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const [topCode, topCount] = sorted[0];
  const tied = sorted.filter(([, n]) => n === topCount).map(([c]) => c);

  let chosen = topCode;
  if (tied.length > 1 && firstAuthorCode && tied.includes(firstAuthorCode.toUpperCase())) {
    chosen = firstAuthorCode.toUpperCase();
  }
  const summary = sorted.map(([c, n]) => `${c}:${n}`).join(", ");
  return {
    actor: actorFromCountry(chosen),
    evidence: `institutions [${summary}] → ${chosen}`,
  };
}
