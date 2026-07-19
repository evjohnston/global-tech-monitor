// EPO Open Patent Services — shared by the Node fetch script and the
// Cloudflare Worker (never the browser: this needs a client secret, which is
// why it's proxied). Uses global fetch + btoa, both available in Node 20+
// and Workers, so no runtime-specific APIs (no node:buffer) are needed.
import { actorFromCountry } from "../actorFromCountry.ts";
import type { Entry } from "../types.ts";
import { asArray } from "./util.ts";

export async function fetchPatents(key: string, secret: string, n: number): Promise<Entry[]> {
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
  // CPC G06N10 = quantum computing. Published-data search, newest first.
  const searchRes = await fetch(
    "https://ops.epo.org/3.2/rest-services/published-data/search/biblio" +
      `?q=cpc%3DG06N10&Range=1-${n}`,
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
      actor: actorFromCountry(country), provenance: "live", source: "patent",
      title: String(title).replace(/\s+/g, " ").trim() || "Quantum computing patent",
      org: `${country} filing`, date: "",
      url: `https://worldwide.espacenet.com/patent/search?q=${num}`,
      actorEvidence: `EPO filing country ${country}`,
    };
  });
}
