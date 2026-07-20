// NSF Awards API — shared by the Node fetch script and the Cloudflare
// Worker (not called directly from the browser: research.gov doesn't send
// CORS headers, confirmed by hand before building the proxy).
import type { Entry } from "../types.ts";

interface NSFAward {
  id?: string; title?: string; awardeeName?: string;
  awardeeCountryCode?: string; fundsObligatedAmt?: string; date?: string; startDate?: string;
  abstractText?: string; pdPIName?: string; program?: string;
}

// `relevant` is the vertical's own RSS relevance regex (verticals.ts) —
// reused here, not duplicated, because it's already hand-tuned per topic.
// Needed because NSF's own `keyword` search is unreliably loose: checked by
// hand (2026-07-20) against the AI vertical's "artificial intelligence"
// query — 226 of 315 returned awards (72%) had neither "artificial" nor
// "intelligence" anywhere in their title OR abstract (squid hydrodynamics,
// wild bee heat resilience, freshwater mussel phylogenetics — real NSF
// grants, just not about AI). `keyword` alone can't be trusted as a
// relevance filter; this re-checks every result against real title/abstract
// text before it's allowed into an Entry.
export async function fetchNSF(n: number, keyword = "quantum", relevant?: RegExp): Promise<Entry[]> {
  const url =
    "https://www.research.gov/awardapi-service/v1/awards.json" +
    `?keyword=${encodeURIComponent(keyword)}` +
    "&printFields=id,title,awardeeName,awardeeCountryCode,fundsObligatedAmt,date,startDate,abstractText,pdPIName,program" +
    `&rpp=${n}`;
  const res = await fetch(url, { headers: { "User-Agent": "GlobalTechMonitor/0.3" } });
  if (!res.ok) throw new Error(`NSF HTTP ${res.status}`);
  const json = (await res.json()) as { response?: { award?: NSFAward[] } };
  const rawAwards = json.response?.award ?? [];
  const awards = relevant
    ? rawAwards.filter((a) => relevant.test(a.title ?? "") || relevant.test(a.abstractText ?? ""))
    : rawAwards;
  return awards.map((a): Entry => {
    const amt = Number(a.fundsObligatedAmt ?? 0) || undefined;
    // NSF's `date` field is the real award/announcement date. `startDate` is
    // the funded period's effective start, which is routinely months in the
    // future (a 2026 award commonly starts its funding period in 2027) —
    // using it as this entry's date made grants look like they "happened"
    // on a date that hadn't occurred yet, throwing off sort order and every
    // trailing-window stat. Confirmed both fields on a live sample
    // (2026-07-20): `date` is always <= today, `startDate` routinely isn't.
    const d = a.date ?? ""; // MM/DD/YYYY → ISO
    const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(d)
      ? `${d.slice(6, 10)}-${d.slice(0, 2)}-${d.slice(3, 5)}` : d.slice(0, 10);
    // NSF awardees are overwhelmingly US institutions; a missing code on an
    // NSF award is reasonably read as US rather than unknown, unlike a
    // generic missing-data case elsewhere in this app.
    const country = a.awardeeCountryCode ?? "US";
    return {
      id: `nsf-${a.id ?? Math.random().toString(36).slice(2)}`,
      stage: "investment",
      country,
      provenance: "live", source: "grant",
      title: (a.title ?? "").replace(/\s+/g, " ").trim(),
      org: a.awardeeName ?? "", date: iso,
      url: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${a.id ?? ""}`,
      amountUsd: amt,
      countryEvidence: `NSF awardee country ${country}`,
      abstract: a.abstractText?.trim() || undefined,
      authors: a.pdPIName ? [a.pdPIName] : undefined,
      venue: a.program || undefined,
    };
  });
}
