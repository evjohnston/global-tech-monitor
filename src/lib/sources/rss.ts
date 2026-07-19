// Live RSS feed for scaling/adoption — the two stages that otherwise have no
// queryable API and were entirely hand-curated (data/<vertical>/seed.ts).
// Runtime-agnostic (global fetch only) so it runs in Node, Workers, and — for
// whichever feed has open CORS — the browser. Feed lists and classifiers are
// per-vertical (see src/lib/verticals.ts); this module is the shared,
// tech-agnostic fetch/parse/classify machinery, checked by hand per vertical
// before any feed is added: each must return valid RSS 2.0 XML from a real,
// actively-publishing trade outlet, not a blog or forum.
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

// A keyword classifier for one vertical. `relevant` gates topical relevance
// before anything else runs (protects against a general-purpose outlet
// joining a feed list later and polluting results with off-topic items).
// `exclude` defaults to DEFAULT_EXCLUDE_WORDS below (personnel/podcast/
// funding-round noise that isn't specific to any one vertical) — override
// only if a vertical needs something added on top of that baseline.
export interface RssClassifierConfig {
  relevant: RegExp;
  scaling: RegExp;
  adoption: RegExp;
  exclude?: RegExp;
}

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

// Shared noise filter, vertical-agnostic — checked against real quantum feed
// output while building this, and refined against real false positives it
// produced: personnel/hiring news and podcast episodes were both getting
// swept into "adoption" on loose keyword overlap, and VC funding-round
// headlines (money words alone) were getting mistaken for adoption when
// they're really a third kind of story this app doesn't track at all.
// Excluded items are dropped outright, before the stage check — company news
// isn't a milestone in either sense, however it's worded. Every vertical's
// classifier uses this by default (see RssClassifierConfig above); override
// only to add something on top, not to replace it.
export const DEFAULT_EXCLUDE_WORDS =
  /\b(joins|appoints?|appointment|executive\s+(?:leadership|team)|hires?|welcomes\s+\S+\s+as|names?\s+\S+\s+as|who.s\s+news|podcast|webinar|\bepisode\b|profile|interview|op-ed|obituary|raises?\s+(?:US)?\$|seed\s+round|series\s+[a-e]\b|venture\s+capital|conference|summit|symposium|register\s+now|call\s+for\s+papers|complete\s+(?:vendor\s+)?guide|vendor\s+guide|companies\s+\d{4}|^what\s+(?:is|are)\b|\?$)/i;

// Deliberately conservative: an item matching BOTH scaling and adoption
// words, or NEITHER, is dropped rather than assigned to a guessed stage.
// Money words are intentionally NOT a signal on their own (a private funding
// round isn't adoption or investment in this app's sense) — "grant"/"award"
// stay because they mostly show up attached to a genuine government program.
function classifyStage(title: string, description: string, classifier: RssClassifierConfig): Stage | null {
  const text = `${title} ${description}`;
  if (!classifier.relevant.test(text)) return null;
  if ((classifier.exclude ?? DEFAULT_EXCLUDE_WORDS).test(text)) return null;
  const scaling = classifier.scaling.test(text);
  const adoption = classifier.adoption.test(text);
  if (scaling && !adoption) return "scaling";
  if (adoption && !scaling) return "adoption";
  return null; // ambiguous or neither — not a clean fit, drop it
}

function parseDate(pubDate: string): string {
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

async function fetchOneFeed(feed: RssFeedConfig, cutoffMs: number, classifier: RssClassifierConfig): Promise<Entry[]> {
  const res = await fetch(feed.url, { headers: { "User-Agent": "GlobalTechMonitor/0.3 (research dashboard)" } });
  if (!res.ok) throw new Error(`${feed.name} HTTP ${res.status}`);
  const items = parseRssItems(await res.text());
  const out: Entry[] = [];
  for (const item of items) {
    const date = parseDate(item.pubDate);
    if (!date || new Date(date).getTime() < cutoffMs) continue;
    const stage = classifyStage(item.title, item.description, classifier);
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

// Fetches every configured feed for one vertical; one dead/changed feed
// doesn't drop the others (same soft-fail ethos as every other source in
// this app).
export async function fetchNewsRss(
  feeds: RssFeedConfig[],
  classifier: RssClassifierConfig,
  sinceDays = 30
): Promise<Entry[]> {
  const cutoffMs = Date.now() - sinceDays * 864e5;
  const results = await Promise.allSettled(feeds.map((f) => fetchOneFeed(f, cutoffMs, classifier)));
  const out: Entry[] = [];
  for (const r of results) if (r.status === "fulfilled") out.push(...r.value);
  // De-dupe by id in case two outlets syndicate the same story to the same link.
  const byId = new Map<string, Entry>();
  for (const e of out) byId.set(e.id, e);
  return [...byId.values()];
}
