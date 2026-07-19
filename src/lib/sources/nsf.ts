// NSF Awards API — shared by the Node fetch script and the Cloudflare
// Worker (not called directly from the browser: research.gov doesn't send
// CORS headers, confirmed by hand before building the proxy).
import type { Entry } from "../types.ts";

interface NSFAward {
  id?: string; title?: string; awardeeName?: string;
  awardeeCountryCode?: string; fundsObligatedAmt?: string; startDate?: string;
}

export async function fetchNSF(n: number, keyword = "quantum"): Promise<Entry[]> {
  const url =
    "https://www.research.gov/awardapi-service/v1/awards.json" +
    `?keyword=${encodeURIComponent(keyword)}` +
    "&printFields=id,title,awardeeName,awardeeCountryCode,fundsObligatedAmt,startDate" +
    `&rpp=${n}`;
  const res = await fetch(url, { headers: { "User-Agent": "GlobalTechMonitor/0.3" } });
  if (!res.ok) throw new Error(`NSF HTTP ${res.status}`);
  const json = (await res.json()) as { response?: { award?: NSFAward[] } };
  const awards = json.response?.award ?? [];
  return awards.map((a): Entry => {
    const amt = Number(a.fundsObligatedAmt ?? 0) || undefined;
    const d = a.startDate ?? ""; // MM/DD/YYYY → ISO
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
    };
  });
}
