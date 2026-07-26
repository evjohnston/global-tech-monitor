// The vertical registry — one entry per technology tracked by this app.
// Every fetch path (scripts/fetch-data.ts, worker/, the browser live-refresh
// in App.tsx) reads its per-source query config from here, so a new vertical
// is added in exactly one place rather than four. Adding a vertical is real
// work, not a flag flip: each needs its own OpenAlex filter (checked by hand
// for institution-data quality), EPO CPC code, funding-source keyword, and
// verified RSS feeds — see CLAUDE.md's "How to extend" section.
import type { RssClassifierConfig, RssFeedConfig } from "./sources/rss.ts";

export interface VerticalConfig {
  id: string; // matches DataFile.technology, and the public/data/<id>.json filename
  number: string; // display order in the topbar, e.g. "01"
  label: string; // full name, rendered as the pagehead <h1> — e.g. "Quantum Technologies"
  shortLabel: string; // topbar-compact name, e.g. "Quantum"
  tagline: string; // pagehead subtitle
  dataDir: string; // data/<dataDir>/{seed,notes}.ts — shown in the footer's "sources & method" note
  openAlexFilter: string; // raw OpenAlex filter fragment
  arxivCategory: string; // arXiv category for the break-glass fallback if OpenAlex itself is unreachable
  epoCpcQuery: string; // raw EPO OPS CQL fragment, or "" to skip patents entirely (see epo.ts)
  fundingKeyword: string; // NSF Awards API query value — a free-text keyword
  rssFeeds: RssFeedConfig[];
  rssClassifier: RssClassifierConfig;
  investmentNewsQuery: string; // Google News RSS search query for investment-stage funding news
  // Real, publicly-traded companies materially exposed to this vertical —
  // feeds the standalone "public markets" panel (market cap, today's move)
  // via the Massive REST API, see src/lib/sources/massive.ts. Not part of
  // the 4-stage pipeline; a stock isn't a research/scaling/adoption/
  // investment event.
  tickers: string[];
}

const QUANTUM_RSS_FEEDS: RssFeedConfig[] = [
  { url: "https://thequantuminsider.com/feed/", name: "The Quantum Insider", corsOpen: true },
  { url: "https://www.insidequantumtechnology.com/feed/", name: "Inside Quantum Technology", corsOpen: false },
  { url: "https://quantumcomputingreport.com/feed/", name: "Quantum Computing Report", corsOpen: false },
  // By far the highest-volume of the four (~200 items covering ~5 days vs.
  // 10 items/feed for the others) — also carries a lot of listicle/explainer
  // content the others don't, which is what the exclude pattern below is
  // specifically tuned against.
  { url: "https://quantumzeitgeist.com/feed/", name: "Quantum Zeitgeist", corsOpen: false },
];

const QUANTUM_RSS_CLASSIFIER: RssClassifierConfig = {
  relevant: /quantum/i,
  scaling:
    /\b(qubit|chip|processor|fidelity|error.correct|fabricat|\bfab\b|roadmap|superconducting|photonic|neutral.atom|trapped.ion|topological|spin.qubit|dilution\s+refrigerator|coherence|logical\s+qubit|quantum\s+volume)\b/i,
  adoption:
    /\b(deploy|procure(?:ment)?|contract|cloud\s+access|partner(?:ship)?|government|commercial(?:ize|ization)?|customer|pilot\s+program|benchmark|data\s*cent(?:er|re)|co-locat|grant|award(?:ed|s)?|national\s+quantum(?:\s+mission|\s+initiative|\s+strategy)?)\b/i,
};

// AI trade press verified by hand (2026-07-19): each returns valid RSS 2.0
// XML from a real, actively-publishing outlet. Only aibusiness.com sends an
// open Access-Control-Allow-Origin (checked via curl) — the rest are proxied
// through the Worker, same pattern as quantum's thequantuminsider.com.
const AI_RSS_FEEDS: RssFeedConfig[] = [
  { url: "https://aibusiness.com/rss.xml", name: "AI Business", corsOpen: true },
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", name: "TechCrunch AI", corsOpen: false },
  { url: "https://venturebeat.com/category/ai/feed/", name: "VentureBeat AI", corsOpen: false },
  { url: "https://www.artificialintelligence-news.com/feed/", name: "AI News", corsOpen: false },
  { url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", name: "MIT Technology Review AI", corsOpen: false },
  { url: "https://www.marktechpost.com/feed/", name: "MarkTechPost", corsOpen: false },
];

// AI's equivalent of "qubit count" is compute/parameter scale; its equivalent
// of "deploy a quantum computer" is a model or platform going into real use.
// Tuned against a first real fetch, same as quantum's classifier — see
// CLAUDE.md before loosening either pattern.
const AI_RSS_CLASSIFIER: RssClassifierConfig = {
  relevant: /\b(AI|A\.I\.|artificial\s+intelligence|machine\s+learning|neural\s+network|deep\s+learning|large\s+language\s+model|\bLLM\b|foundation\s+model|generative\s+AI|genai)\b/i,
  scaling:
    /\b(GPU|TPU|accelerator\s+chip|compute\s+cluster|training\s+run|parameter[s]?|foundation\s+model|frontier\s+model|supercomputer|data\s*cent(?:er|re)\s+(?:buildout|expansion)|exaflop|model\s+weights|open.source\s+model|context\s+window|inference\s+cluster)\b/i,
  adoption:
    /\b(deploy|integrat|enterprise|rollout|partner(?:ship)?|government|commercial(?:ize|ization)?|customer|pilot\s+program|adopt(?:s|ed|ion)?|procure(?:ment)?|contract|cloud\s+access|co-locat|grant|national\s+ai\s+(?:strategy|initiative)|regulat|policy)\b/i,
};

export const VERTICALS: VerticalConfig[] = [
  {
    id: "quantum-computing",
    number: "01",
    label: "Quantum Technologies",
    shortLabel: "Quantum",
    tagline: "Quantum computing · innovation, scaling, adoption, investment",
    dataDir: "quantum",
    // T10682 "Quantum Computing Algorithms and Architecture" is the core
    // Topic; T10020 "Quantum Information and Cryptography" (added 2026-07-19
    // from a hand-scan of the 4,516-topic OpenAlex Topic list in
    // topics.json) covers quantum crypto/info-theory work T10682 alone
    // misses — a live sample of T10020 came back real quantum-computing
    // papers (quantum circuits, photonic qubits, quantum algorithms), not
    // classical crypto. See src/lib/sources/openalex.ts.
    openAlexFilter: "topics.id:T10682|T10020",
    arxivCategory: "quant-ph",
    epoCpcQuery: "cpc=G06N10",
    fundingKeyword: "quantum",
    rssFeeds: QUANTUM_RSS_FEEDS,
    rssClassifier: QUANTUM_RSS_CLASSIFIER,
    // Checked by hand (2026-07-19): real NSF-grant writeups, government
    // funding announcements, and legit private R&D commitments, with the
    // stock-ticker/investor-advice noise a bare "quantum funding" query
    // pulls in filtered by rss.ts's FUNDING_RELEVANT/STOCK_NOISE_WORDS gates.
    investmentNewsQuery: '"quantum computing" (grant OR funding OR investment OR "national quantum" OR NSF)',
    // Broadened 2026-07-24 from an original hand-picked 6 (pure-plays +
    // large-cap incumbents) to 26 — built via a real research pass across
    // pure-play hardware/software, large incumbents with named quantum
    // programs, defense/aerospace contractors with documented quantum
    // sensing/computing programs, and semiconductor/fab-equipment makers
    // with real quantum-hardware R&D, each individually verified to have a
    // specific, named quantum initiative (not just "big company, probably
    // does quantum somewhere"). Every ticker here also confirmed live
    // against Massive's reference endpoint to actually carry market-cap
    // data — 11 more real, defensible candidates (Archer Materials, BAE
    // Systems, Airbus, Fujitsu, NTT, NEC, Mitsubishi Electric, Thales,
    // Samsung — foreign OTC ADRs) resolve on Massive but carry no market
    // cap on this plan tier, and 2 (Toshiba's TOSYY, Quantum eMotion's
    // QNCCF) don't resolve at all — all excluded rather than shown as
    // empty rows. Since all of these except the 3 pure-plays are large
    // diversified companies, their SEC-EDGAR R&D-spend figure (see
    // secEdgar.ts) is total corporate R&D, not quantum-specific R&D —
    // Lockheed Martin's real R&D spend is overwhelmingly not about
    // quantum computing. Disclosed in CLAUDE.md; don't read the R&D chart
    // as "R&D spent on quantum" for anything past the 3 pure-plays.
    tickers: [
      "IONQ", "RGTI", "QBTS", "QUBT", "ARQQ", "LAES", // pure-play quantum hardware/software
      "IBM", "GOOGL", "MSFT", "AMZN", "HON", "INTC", "NVDA", // large incumbents, named quantum programs
      "LMT", "NOC", "RTX", "GD", "LHX", "LDOS", "BAH", // defense/aerospace, documented quantum programs
      "AMAT", "ASML", "HPE", "CSCO", "NOK", "SKM", // semiconductor/fab equipment + quantum networking
    ],
  },
  {
    id: "artificial-intelligence",
    number: "02",
    label: "Artificial Intelligence",
    shortLabel: "AI",
    tagline: "Artificial intelligence · innovation, scaling, adoption, investment",
    dataDir: "ai",
    // OpenAlex's Topic taxonomy fragments AI across dozens of narrow
    // application topics (AI in healthcare, AI in law, AI in materials
    // science...) with no single cohesive "core AI" Topic the way quantum
    // has T10682. This USED to just be subfield 1702 ("Artificial
    // Intelligence") wholesale, but that subfield is itself a grab-bag —
    // hand-scanning the full 4,516-topic OpenAlex list in topics.json
    // (2026-07-19) found subfield 1702 pulling in Geochemistry and Geologic
    // Mapping (166k works), Seismology and Earthquake Studies (49.6k), Solar
    // Radiation and Photovoltaics (41.5k), and Data Analysis with R — all
    // miscategorized into "AI" by OpenAlex, none actually AI research. Some
    // topics that sound on-topic by name turned out noisy on a live sample
    // too (T11574 "AI in Games" is game-studies/esports-culture papers,
    // T13567 "AI and Multimedia in Education" is vocational-pedagogy papers,
    // T13851 "Law, AI, and IP" is AI-regulation law review, not research
    // output) and were excluded for that reason, not by name. This is now an
    // explicit OR'd list of the topics that passed a hand-check of their
    // actual recent works: the real AI/ML topics from subfield 1702, plus
    // all of subfield 1707 (Computer Vision and Pattern Recognition, a
    // separate OpenAlex subfield that's unambiguously core AI methodology
    // OpenAlex doesn't file under 1702). Net effect on a live 30-day sample:
    // 14,180 works vs. 7,564 for the old subfield-1702-only filter (more
    // real AI/ML volume, not less, despite excluding the non-AI topics) and
    // 96% structured institution-country coverage on a 50-work sample
    // (matches the original 49/50 subfield-only check).
    openAlexFilter:
      "topics.id:T10028|T10036|T10052|T10057|T10100|T10181|T10201|T10320|T10331|T10444|T10456|T10462|T10531|T10601|T10627|T10637|T10664|T10688|T10775|T10812|T10820|T10824|T10862|T10906|T11019|T11105|T11273|T11303|T11307|T11439|T11448|T11512|T11550|T11605|T11612|T11652|T11689|T11714|T11901|T11902|T11975|T12026|T12031|T12072|T12262|T12357|T12380|T12535|T12549|T12611|T12676|T12761|T12814|T13062|T13083|T13629|T13702|T13904",
    // cs.AI is arXiv's broadest general-AI category — same break-glass role
    // as quant-ph for quantum, only reached if OpenAlex is unreachable.
    arxivCategory: "cs.AI",
    // G06N3 = neural networks, G06N20 = machine learning specifically — AI
    // has no single CPC code the way quantum's G06N10 does, so this ORs the
    // two real subclasses that between them cover the field's hardware/
    // methods patents. Confirmed via USPTO/WIPO CPC definitions, not tested
    // live yet (no local EPO key) — soft-fails like every other source here
    // if the query turns out to need adjustment.
    epoCpcQuery: "cpc=G06N3 OR cpc=G06N20",
    fundingKeyword: "artificial intelligence",
    rssFeeds: AI_RSS_FEEDS,
    rssClassifier: AI_RSS_CLASSIFIER,
    // Checked by hand (2026-07-19) — noisier than quantum's equivalent query
    // (AI funding news attracts more stock-picking/investor-advice filler),
    // cleaned up by the same shared FUNDING_RELEVANT/STOCK_NOISE_WORDS gates.
    investmentNewsQuery:
      '"artificial intelligence" (grant OR funding OR investment OR "national ai" OR "ai strategy" OR NSF)',
    // Broadened 2026-07-24 from an original hand-picked 6 to 47 — built via
    // a real research pass across AI chip/hardware, frontier-lab
    // incumbents, AI-native application software, enterprise software with
    // named AI products, and AI-infrastructure/data-center names, each
    // individually verified to have a specific, named AI program or
    // product. Every ticker confirmed live against Massive's reference
    // endpoint to actually carry market-cap data — 3 candidates (Tencent,
    // SoftBank, Samsung — foreign OTC ADRs) resolve on Massive but carry no
    // market cap on this plan tier and are excluded rather than shown as
    // empty rows (Alibaba and Baidu, both real ADR-listed on a US
    // exchange, DO carry market cap and are kept). Same caveat as
    // quantum's list: for the semiconductor-equipment and general
    // data-center-infrastructure names (LRCX/KLAC/AMAT/TER, VRT/DELL/HPE/
    // ANET), SEC-EDGAR R&D spend (secEdgar.ts) is total corporate R&D, not
    // AI-specific spend — see CLAUDE.md.
    tickers: [
      "NVDA", "TSM", "AVGO", "AMD", "ASML", "ARM", "MRVL", "QCOM", "MU", "SMCI", // AI chips/hardware
      "MSFT", "GOOGL", "AMZN", "META", "CRWV", "NBIS", "ORCL", // frontier labs / AI cloud infra incumbents
      "PLTR", "AI", "SOUN", "BBAI", "INOD", "PATH", "APP", // AI-native application software
      "CRM", "NOW", "ADBE", "SNOW", "SAP", "IBM", "MDB", "WDAY", "CRWD", "PANW", "DDOG", // enterprise software, named AI products
      "BABA", "BIDU", // foreign AI labs with real US-tradable ADRs
      "VRT", "DELL", "HPE", "ANET", "CRDO", "ALAB", // AI data-center infrastructure
      "LRCX", "KLAC", "AMAT", "TER", // AI-chip fabrication equipment
    ],
  },
];

// A "talent" (STEM workforce / human capital) vertical was built and shipped
// 2026-07-24, then archived 2026-07-25 as not fitting this app's scope — it
// didn't cleanly cover the innovation stage's own gate (no coherent OpenAlex
// research corpus, no real patent classification, no public-company ticker
// concept), needing more workarounds (an OECD researcher-headcount stand-in
// for papers, a CFDA-code NSF query) than any of this app's other verticals.
// Its full code (VerticalConfig entry, RSS feeds/classifier, data/talent/
// seed+notes, src/lib/sources/oecd.ts) is preserved on the git branch
// `archive/talent-vertical`, cut from the commit immediately before removal
// — restorable in full if this vertical is worth rebuilding later. See
// CLAUDE.md for the removal note.

export function verticalById(id: string): VerticalConfig {
  return VERTICALS.find((v) => v.id === id) ?? VERTICALS[0];
}
