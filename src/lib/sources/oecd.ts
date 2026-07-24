// OECD.Stat SDMX REST API — real, official per-country R&D personnel
// (researcher) headcount. Built for the Talent vertical, whose "Innovation"
// stage stands in for what OpenAlex papers do for quantum/AI: there is no
// cohesive OpenAlex research-topic for "human capital" (a live sample
// against the closest topics — labor economics, HR/talent management, STEM
// education — came back a grab-bag of vocational-pedagogy and generic
// HR-management papers, not a coherent signal, checked by hand 2026-07-24),
// so this vertical leads with a real statistic instead of a paper corpus.
// No key needed — OECD.Stat is public.
import countries from "i18n-iso-countries";
import type { Entry } from "../types.ts";
import { countryName } from "../countries.ts";

const BASE = "https://sdmx.oecd.org/public/rest/data";
// OECD.STI.STP,DSD_RDS_PERS@DF_PERS_FUNC,1.0 = "R&D personnel by sector of
// performance and function" (part of the Main Science and Technology
// Indicators database). Filter key confirmed live (2026-07-24), dot-
// separated in DSD dimension order: REF_AREA(wild).FREQ=A(annual).
// MEASURE=T_RD(R&D personnel).SECT_PERF=_T(all sectors, not just business/
// gov/academia).FORD=_T.ACTIVITY=_T.FUNCTION=RSE(researchers specifically —
// excludes technicians/support staff).EDUCATION_LEV=_T.SEX=_T(not split by
// sex).EMP_STATUS=INT(internal staff, the standard reporting basis).
// UNIT_MEASURE=PS_FTE(full-time-equivalent persons — OECD's own
// cross-country comparability unit; a raw-headcount "PS" variant exists too
// but isn't used here, to avoid mixing units within one Entry set).
const FILTER = ".A.T_RD._T._T._T.RSE._T._T.INT.PS_FTE";

// Minimal quoted-CSV line parser — OECD's csvfilewithlabels format quotes
// fields containing commas (e.g. "Korea, Republic of"), so a plain split(",")
// would misalign columns on exactly the rows this needs to get right.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export async function fetchResearcherStats(sinceYear: number): Promise<Entry[]> {
  const url =
    `${BASE}/OECD.STI.STP,DSD_RDS_PERS@DF_PERS_FUNC,1.0/${FILTER}` +
    `?format=csvfilewithlabels&startPeriod=${sinceYear}`;
  // Accept-Language matters here, not just Accept: Node's fetch sends
  // "Accept-Language: *" by default (confirmed by hand, 2026-07-24 — curl,
  // which sends no Accept-Language, got a clean 200 on an identical
  // request while Node's fetch got a 500 with body "languageTag1"), and
  // OECD's server appears to throw on that wildcard value. Pin it to a real
  // language instead of leaving Node's default in place.
  const res = await fetch(url, { headers: { Accept: "text/csv", "Accept-Language": "en" } });
  if (!res.ok) throw new Error(`OECD HTTP ${res.status}`);
  const text = (await res.text()).trim();
  if (!text) return [];
  const lines = text.split("\n");
  const header = parseCsvLine(lines[0]);
  const iArea = header.indexOf("REF_AREA");
  const iAreaName = header.indexOf("Reference area");
  const iYear = header.indexOf("TIME_PERIOD");
  const iVal = header.indexOf("OBS_VALUE");

  const entries: Entry[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const alpha3 = cols[iArea];
    const areaName = cols[iAreaName];
    const year = cols[iYear];
    const raw = cols[iVal];
    if (!raw) continue; // missing observation for this country/year
    const fte = Math.round(Number(raw));
    if (!Number.isFinite(fte)) continue;
    const country = countries.alpha3ToAlpha2(alpha3) ?? null;
    // Use this app's own display name (countryName() applies the
    // COMMON_NAME overrides, e.g. "China" not "China (People's Republic
    // of)") rather than OECD's raw CSV label, for consistency with every
    // other country-attributed title in the app.
    const displayName = countryName(country) !== "Unknown" ? countryName(country) : areaName;
    entries.push({
      id: `oecd-rdpers-${alpha3}-${year}`,
      stage: "innovation",
      country,
      provenance: "live",
      source: "statistic",
      title: `${displayName}: ${fte.toLocaleString("en-US")} researchers (FTE), ${year}`,
      org: "",
      date: `${year}-12-31`,
      url: "https://data-explorer.oecd.org/vis?df[ds]=DisseminateFinalDMZ&df[id]=DSD_RDS_PERS%40DF_PERS_FUNC&df[ag]=OECD.STI.STP",
      countryEvidence: `OECD Main Science and Technology Indicators — R&D personnel reported by ${areaName}'s national statistical office`,
    });
  }
  return entries;
}
