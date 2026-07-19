// Live RSS feed for scaling/adoption — the two stages that otherwise have no
// queryable API and were entirely hand-curated (data/seed.ts). Checked by
// hand before picking these three: each returns valid RSS 2.0 XML and is a
// real, actively-publishing quantum-industry trade outlet, not a blog or
// forum. Runtime-agnostic (global fetch only) so it runs in Node, Workers,
// and — for the one feed with open CORS — the browser.
//
// Honesty tier: this is the WEAKEST attribution path in the app. Stage and
// country are both a keyword guess against the headline/summary, not a
// verified fact. Every entry gets provenance "auto" (not "live") so the UI
// never implies this is as solid as OpenAlex's institution attribution or a
// hand-verified seed entry. Ambiguous or unclassifiable items are dropped
// rather than guessed into the wrong stage.
import type { Entry, Stage } from "../types.ts";
import { inferInstitutionCountry } from "../institutionCountry.ts";

export interface RssFeedConfig {
  url: string;
  name: string;
  corsOpen: boolean; // confirmed by hand — access-control-allow-origin present
}

export const QUANTUM_NEWS_FEEDS: RssFeedConfig[] = [
  { url: "https://thequantuminsider.com/feed/", name: "The Quantum Insider", corsOpen: true },
  { url: "https://www.insidequantumtechnology.com/feed/", name: "Inside Quantum Technology", corsOpen: false },
  { url: "https://quantumcomputingreport.com/feed/", name: "Quantum Computing Report", corsOpen: false },
  // By far the highest-volume of the four (~200 items covering ~5 days vs.
  // 10 items/feed for the others) — also carries a lot of listicle/explainer
  // content the others don't, which is what EXCLUDE_WORDS' guide/"what is"
  // patterns below are specifically tuned against.
  { url: "https://quantumzeitgeist.com/feed/", name: "Quantum Zeitgeist", corsOpen: false },
];

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘").replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    // Numeric entities (decimal &#8217; and hex &#x2019;) before the &amp;
    // catch-all, since &amp; would otherwise mangle &#038; (ampersand
    // itself, decimal 38) into a double-escaped "&amp;#038;"-shaped mess.
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ") // strip any inline markup in description
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

interface RssItem { title: string; link: string; pubDate: string; description: string }

function parseRssItems(xml: string): RssItem[] {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return blocks.map((block) => ({
    title: extractTag(block, "title"),
    link: extractTag(block, "link"),
    pubDate: extractTag(block, "pubDate"),
    description: extractTag(block, "description"),
  }));
}

// Keyword classifier. Checked against real feed output by hand while
// building this, and refined against real false positives it produced:
// personnel/hiring news and podcast episodes were both getting swept into
// "adoption" on loose keyword overlap, and VC funding-round headlines
// (money words alone) were getting mistaken for adoption when they're
// really a third kind of story this app doesn't track at all. Excluded
// items are dropped outright, before the stage check — company news isn't
// a milestone in either sense, however it's worded.
const EXCLUDE_WORDS =
  /\b(joins|appoints?|appointment|executive\s+(?:leadership|team)|hires?|welcomes\s+\S+\s+as|names?\s+\S+\s+as|who.s\s+news|podcast|webinar|\bepisode\b|profile|interview|op-ed|obituary|raises?\s+(?:US)?\$|seed\s+round|series\s+[a-e]\b|venture\s+capital|conference|summit|symposium|register\s+now|call\s+for\s+papers|complete\s+(?:vendor\s+)?guide|vendor\s+guide|companies\s+\d{4}|^what\s+(?:is|are)\b|\?$)/i;

// Deliberately conservative beyond that: an item matching BOTH sets, or
// NEITHER, is dropped rather than assigned to a guessed stage. Money words
// are intentionally NOT a signal here on their own (a private funding round
// isn't adoption or investment in this app's sense) — "grant"/"award" stay
// because they mostly show up attached to a genuine government program.
const SCALING_WORDS =
  /\b(qubit|chip|processor|fidelity|error.correct|fabricat|\bfab\b|roadmap|superconducting|photonic|neutral.atom|trapped.ion|topological|spin.qubit|dilution\s+refrigerator|coherence|logical\s+qubit|quantum\s+volume)\b/i;
const ADOPTION_WORDS =
  /\b(deploy|procure(?:ment)?|contract|cloud\s+access|partner(?:ship)?|government|commercial(?:ize|ization)?|customer|pilot\s+program|benchmark|data\s*cent(?:er|re)|co-locat|grant|award(?:ed|s)?|national\s+quantum(?:\s+mission|\s+initiative|\s+strategy)?)\b/i;
// A general-purpose HPC/tech outlet could join this list later — this gate
// keeps that safe by requiring real topical relevance regardless of source,
// rather than assuming every feed here is 100% quantum content.
const QUANTUM_RELEVANT = /quantum/i;

function classifyStage(title: string, description: string): Stage | null {
  const text = `${title} ${description}`;
  if (!QUANTUM_RELEVANT.test(text)) return null;
  if (EXCLUDE_WORDS.test(text)) return null;
  const scaling = SCALING_WORDS.test(text);
  const adoption = ADOPTION_WORDS.test(text);
  if (scaling && !adoption) return "scaling";
  if (adoption && !scaling) return "adoption";
  return null; // ambiguous or neither — not a clean fit, drop it
}

function parseDate(pubDate: string): string {
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

async function fetchOneFeed(feed: RssFeedConfig, cutoffMs: number): Promise<Entry[]> {
  const res = await fetch(feed.url, { headers: { "User-Agent": "GlobalTechMonitor/0.3 (research dashboard)" } });
  if (!res.ok) throw new Error(`${feed.name} HTTP ${res.status}`);
  const items = parseRssItems(await res.text());
  const out: Entry[] = [];
  for (const item of items) {
    const date = parseDate(item.pubDate);
    if (!date || new Date(date).getTime() < cutoffMs) continue;
    const stage = classifyStage(item.title, item.description);
    if (!stage) continue;
    const { country, evidence } = inferInstitutionCountry(`${item.title} ${item.description}`);
    const idSlug = item.link.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(-70);
    out.push({
      id: `rss-${idSlug}`,
      stage, country, provenance: "auto",
      source: stage === "scaling" ? "milestone" : "deployment",
      title: item.title, org: feed.name, date, url: item.link,
      countryEvidence: `${evidence} (auto-classified from ${feed.name} RSS, unverified)`,
    });
  }
  return out;
}

// Fetches every configured feed; one dead/changed feed doesn't drop the
// others (same soft-fail ethos as every other source in this app).
export async function fetchQuantumNewsRss(sinceDays = 30, feeds = QUANTUM_NEWS_FEEDS): Promise<Entry[]> {
  const cutoffMs = Date.now() - sinceDays * 864e5;
  const results = await Promise.allSettled(feeds.map((f) => fetchOneFeed(f, cutoffMs)));
  const out: Entry[] = [];
  for (const r of results) if (r.status === "fulfilled") out.push(...r.value);
  // De-dupe by id in case two outlets syndicate the same story to the same link.
  const byId = new Map<string, Entry>();
  for (const e of out) byId.set(e.id, e);
  return [...byId.values()];
}
