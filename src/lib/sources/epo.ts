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
  return docs.slice(0, n).map((d: any, i: number): Entry => {
    const ex = d?.["exchange-document"] ?? {};
    const country = ex?.["@country"] ?? "";
    const titleNode = ex?.["bibliographic-data"]?.["invention-title"];
    const title = Array.isArray(titleNode)
      ? (titleNode.find((t: any) => t?.["@lang"] === "en")?.["$"] ?? titleNode[0]?.["$"] ?? "")
      : titleNode?.["$"] ?? "Patent filing";
    const num = `${country}${ex?.["@doc-number"] ?? i}`;
    return {
      id: `epo-${num}`, stage: "innovation",
      country: country || null, provenance: "live", source: "patent",
      title: String(title).replace(/\s+/g, " ").trim() || "Quantum computing patent",
      org: `${country} filing`, date: "",
      url: `https://worldwide.espacenet.com/patent/search?q=${num}`,
      countryEvidence: country ? `EPO filing country ${country}` : "EPO record has no filing country",
    };
  });
}
