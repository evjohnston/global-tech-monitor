// Canonicalizes an organization's raw name into a stable id, so counts
// (Top Institutions, org-level filters) group the same real org together
// instead of splitting it across case variants ("NVIDIA" vs "Nvidia") or
// legal-suffix variants ("Samsung Electronics" vs "Samsung Electronics Co.,
// Ltd."). Two layers, the same pattern as countries.ts's COMMON_NAME over
// i18n-iso-countries: mechanical normalization first, then a small
// hand-verified alias table for real sub-unit/abbreviation cases confirmed
// against actual entry data (2026-07-20) — see ALIASES below before adding
// to it; only add an entry you've confirmed actually recurs, don't
// speculate.
//
// Deliberately does NOT try to split multi-party strings ("Anthropic,
// Palantir, Amazon Web Services", "IBM, JPMorgan Chase, Daimler, Samsung,
// Oak Ridge National Laboratory") into separate orgs. Checked by hand
// against real data: both commas and semicolons are used inconsistently for
// two different things in this data — one org's legal suffix ("Samsung
// Electronics Co., Ltd.") and a genuine list of several orgs on one deal —
// and a heuristic split risks crediting a multi-party deal to the wrong
// single party or double-counting it. A multi-party entry stays its own
// distinct canonical entity until Entry supports `org: string[]`.
//
// The normalization step preserves non-ASCII letters/digits (Unicode
// \p{L}/\p{N}, not an ASCII-only [a-z0-9] class) — an earlier draft of this
// stripped every non-Latin character, which collapsed every CJK/Cyrillic/
// Devanagari org name down to the same empty string and falsely merged
// unrelated organizations that happened to have no ASCII characters at all.
// Confirmed against real data before shipping: the fix separates every
// previously-colliding non-Latin name back out correctly.
const LEGAL_SUFFIX = /,?\s*(?:Inc\.?|LLC\.?|Ltd\.?|Co\.,?\s*Ltd\.?|Corporation|Corp\.?|PBC|N\.A\.|PLC)\.?$/i;

// Keys here are the POST-normalization form — i.e. what normalizeKey()
// produces after it already strips a legal suffix, so "International
// Business Machines Corporation" keys as "international business
// machines" (the "Corporation" is already gone by the time this table is
// checked), not "...corporation". Verified by re-running the backfill and
// confirming both real raw variants land on the same id (2026-07-20).
const ALIASES: Record<string, string> = {
  // IBM's named sub-units/labs and one legacy-formal-name variant, all
  // referring to the same real organization for this app's purposes —
  // confirmed by hand against the quantum + AI datasets (2026-07-20).
  "international business machines": "IBM",
  "ibm quantum": "IBM",
  "ibm united states": "IBM",
  "ibm research zurich": "IBM",
  "ibm research almaden": "IBM",
};

function normalizeKey(raw: string): string {
  const stripped = raw.replace(LEGAL_SUFFIX, "");
  return stripped.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function canonicalizeOrg(raw: string): { id: string; name: string } {
  const key = normalizeKey(raw);
  if (!key) return { id: raw, name: raw }; // nothing left after stripping — fall back to the raw string as its own id
  const aliasedName = ALIASES[key];
  if (aliasedName) return { id: normalizeKey(aliasedName), name: aliasedName };
  const displayName = raw.replace(LEGAL_SUFFIX, "").trim() || raw;
  return { id: key, name: displayName };
}
