// EPO Open Patent Services — shared by the Node fetch script and the
// Cloudflare Worker (never the browser: this needs a client secret, which is
// why it's proxied). Uses global fetch + btoa, both available in Node 20+
// and Workers, so no runtime-specific APIs (no node:buffer) are needed.
import type { Entry } from "../types.ts";
import { asArray } from "./util.ts";

// `cpcQuery` is the CPC classification's OPS CQL fragment identifying the
// vertical, e.g. "cpc=G06N10" for quantum computing or "cpc=G06N3 OR
// cpc=G06N20" for AI/ML (neural networks + machine learning, since AI has no
// single CPC code the way quantum's G06N10 does — see verticals.ts).
export async function fetchPatents(key: string, secret: string, n: number, cpcQuery: string): Promise<Entry[]> {
  if (!key || !secret) throw new Error("EPO key/secret not set");
  const tokenRes = await fetch("https://ops.epo.org/3.2/auth/accesstoken", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${key}:${secret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) throw new Error(`EPO auth HTTP ${tokenRes.status}`);
  const token = ((await tokenRes.json()) as { access_token?: string }).access_token;
  // Published-data search, newest first.
  const searchRes = await fetch(
    "https://ops.epo.org/3.2/rest-services/published-data/search/biblio" +
      `?q=${encodeURIComponent(cpcQuery)}&Range=1-${n}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
  );
  if (!searchRes.ok) throw new Error(`EPO search HTTP ${searchRes.status}`);
  const data = (await searchRes.json()) as any;
  const docs = asArray(
    data?.["ops:world-patent-data"]?.["ops:biblio-search"]?.["ops:search-result"]?.["exchange-documents"]
  );

  // Applicant/inventor names come in two parallel forms per party — a
  // normalized "epodoc" form (e.g. "KOREA UNIV RESEARCH AND BUSINESS
  // FOUNDATION [KR]") and a human-readable "original" form (e.g. "Korea
  // University Research and Business Foundation") — prefer "original" for
  // display, checked against a real live sample (2026-07-20) before writing
  // this rather than guessed from docs, since OPS's schema is fiddly.
  function partyNames(party: any, nameKey: "applicant-name" | "inventor-name"): string[] {
    const entries = asArray<any>(party);
    const original = entries.filter((e) => e?.["@data-format"] === "original");
    const pool = original.length > 0 ? original : entries;
    const names = pool.map((e) => e?.[nameKey]?.name?.["$"]).filter((n): n is string => Boolean(n));
    return [...new Set(names)];
  }

  // Structured CPC code, e.g. "G06N10/20" — reconstructed from OPS's
  // section/class/subclass/main-group/subgroup breakdown rather than the
  // free-text IPCR field, which is a looser classification.
  function cpcCodes(ex: any): string | undefined {
    const classes = asArray<any>(ex?.["bibliographic-data"]?.["patent-classifications"]?.["patent-classification"]);
    const codes = classes
      .map((c) => {
        const section = c?.section?.["$"], cls = c?.class?.["$"], sub = c?.subclass?.["$"];
        const group = c?.["main-group"]?.["$"], subgroup = c?.subgroup?.["$"];
        if (!section || !cls || !sub || !group) return null;
        return `${section}${cls}${sub}${group}${subgroup ? `/${subgroup}` : ""}`;
      })
      .filter((c): c is string => Boolean(c));
    return codes.length > 0 ? [...new Set(codes)].join(", ") : undefined;
  }

  // Publication date (docdb form, YYYYMMDD) — real and always present,
  // unlike the previously-hardcoded `date: ""`.
  function publicationDate(ex: any): string {
    const ids = asArray<any>(ex?.["bibliographic-data"]?.["publication-reference"]?.["document-id"]);
    const docdb = ids.find((d) => d?.["@document-id-type"] === "docdb");
    const raw = docdb?.date?.["$"] ?? ids[0]?.date?.["$"] ?? "";
    return /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : "";
  }

  return docs.slice(0, n).map((d: any, i: number): Entry => {
    const ex = d?.["exchange-document"] ?? {};
    const country = ex?.["@country"] ?? "";
    const titleNode = ex?.["bibliographic-data"]?.["invention-title"];
    const title = Array.isArray(titleNode)
      ? (titleNode.find((t: any) => t?.["@lang"] === "en")?.["$"] ?? titleNode[0]?.["$"] ?? "")
      : titleNode?.["$"] ?? "Patent filing";
    const num = `${country}${ex?.["@doc-number"] ?? i}`;

    const applicants = partyNames(ex?.["bibliographic-data"]?.parties?.applicants?.applicant, "applicant-name");
    const inventors = partyNames(ex?.["bibliographic-data"]?.parties?.inventors?.inventor, "inventor-name");
    const org = applicants[0] ?? `${country} filing`;
    // OPS's biblio constituent — the same request already made here —
    // includes the abstract directly on some records; confirmed via a real
    // live sample (2026-07-20), not assumed from docs.
    const abstractNode = ex?.abstract;
    const abstractText = Array.isArray(abstractNode)
      ? (abstractNode.find((a: any) => a?.["@lang"] === "en") ?? abstractNode[0])?.p?.["$"]
      : abstractNode?.p?.["$"];

    return {
      id: `epo-${num}`, stage: "innovation",
      country: country || null, provenance: "live", source: "patent",
      title: String(title).replace(/\s+/g, " ").trim() || "Quantum computing patent",
      org, date: publicationDate(ex),
      url: `https://worldwide.espacenet.com/patent/search?q=${num}`,
      countryEvidence: country ? `EPO filing country ${country}` : "EPO record has no filing country",
      authors: inventors.length > 0 ? inventors : undefined,
      classification: cpcCodes(ex),
      abstract: typeof abstractText === "string" ? abstractText.trim() : undefined,
    };
  });
}
