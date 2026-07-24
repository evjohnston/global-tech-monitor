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
  openAlexFilter: string; // raw OpenAlex filter fragment, or "" if this vertical's Innovation stage isn't a paper corpus (see researcherStatsSince)
  // Set only when openAlexFilter is "" — the year to pull OECD researcher-
  // headcount statistics from, feeding the Innovation stage instead of
  // papers (see src/lib/sources/oecd.ts). Unset for every paper-based
  // vertical (quantum, AI).
  researcherStatsSince?: number;
  arxivCategory: string; // arXiv category for the break-glass fallback if OpenAlex itself is unreachable
  epoCpcQuery: string; // raw EPO OPS CQL fragment, or "" to skip patents entirely (see epo.ts)
  fundingKeyword: string; // NSF Awards API query value — a free-text keyword, or a CFDA code if fundingQueryParam is set
  // "keyword" (default) does a free-text title/abstract search — fine when
  // the topic name itself is distinctive (quantum, artificial intelligence).
  // "cfdaNumber" filters by NSF's own funding-program classification code
  // instead — needed when the topic's vocabulary is generic enough to match
  // nearly every grant's boilerplate text (see nsf.ts's fetchNSF comment).
  fundingQueryParam?: "keyword" | "cfdaNumber";
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

// STEM/tech-talent trade press verified by hand (2026-07-24): each returns
// valid RSS 2.0 XML from a real, actively-publishing outlet. A 4th
// candidate (nfap.com, a STEM-immigration policy shop whose analysis would
// have fit well) was dropped after inspection — its /feed/ endpoint returns
// default WordPress placeholder posts ("Sample Blog Post", "Hello world!"),
// not real content, despite a 200 response. Thinner than quantum/AI's list
// by construction: STEM-workforce-specific trade press is a much smaller
// beat than an entire technology's press coverage.
const TALENT_RSS_FEEDS: RssFeedConfig[] = [
  { url: "https://www.insidehighered.com/rss.xml", name: "Inside Higher Ed", corsOpen: false },
  { url: "https://www.nature.com/subjects/careers.rss", name: "Nature Careers", corsOpen: false },
  { url: "https://hechingerreport.org/feed/", name: "The Hechinger Report", corsOpen: false },
];

// Tuned against a real fetch of the three feeds above (2026-07-24): a lot of
// their volume is generic higher-ed politics (accreditation, DEI, campus
// federal fights) or individual career-advice columns, neither of which is
// about the STEM/tech talent pipeline specifically — `relevant` gates on
// pipeline/workforce vocabulary rather than "higher ed" broadly so that
// noise doesn't get pulled in. `scaling` reads as "growing the supply"
// (fellowships, apprenticeships, doctoral training); `adoption` as
// "deploying/moving that supply" (hiring, visas, workforce policy).
const TALENT_RSS_CLASSIFIER: RssClassifierConfig = {
  relevant:
    /\b(STEM workforce|STEM education|STEM pipeline|talent pipeline|talent shortage|worker shortage|labor shortage|skills gap|brain drain|brain gain|H-1B|work visa|skilled immigra|foreign[- ]born (?:scientists?|engineers?|workers?|talent)|graduate research fellow|doctoral (?:pipeline|training|enrollment)|PhD pipeline|apprenticeship|reskill|upskill|workforce development|science and engineering workforce|researchers? (?:shortage|pipeline)|research funding)\b/i,
  scaling:
    /\b(apprenticeship|graduate research fellowship|PhD (?:pipeline|program|enrollment)|doctoral (?:training|enrollment)|STEM education|upskill|reskill|training program|fellowship|scholarship|enrollment (?:growth|increase)|new program|expand(?:s|ed|ing)?\s+(?:program|training)|workforce development)\b/i,
  adoption:
    /\b(hires?|hiring|H-1B|work visa|visa (?:cap|policy|reform)|immigration (?:policy|reform)|industry (?:role|job|position)|employer|deploy(?:ed|ment)?|workforce shortage|labor shortage|policy (?:change|reform)|federal (?:funding|policy)|national\s+(?:ai|quantum)?\s*workforce\s+(?:strategy|initiative)|recruit(?:s|ing|ment)?)\b/i,
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
    // Pure-play public quantum companies (IonQ, Rigetti, D-Wave) plus the
    // large-cap incumbents with named quantum programs (IBM Quantum, Google
    // Quantum AI, Honeywell — majority owner of Quantinuum).
    tickers: ["IONQ", "RGTI", "QBTS", "IBM", "GOOGL", "HON"],
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
    // Large-cap compute/model incumbents (Nvidia hardware; Microsoft,
    // Alphabet, Meta, Amazon frontier labs + cloud AI) plus Palantir as the
    // largest pure-play public AI-application company.
    tickers: ["NVDA", "MSFT", "GOOGL", "META", "AMZN", "PLTR"],
  },
  {
    id: "talent",
    number: "03",
    label: "STEM Talent & Human Capital",
    shortLabel: "Talent",
    tagline: "Human capital · researchers, the STEM workforce pipeline, and public investment in people",
    dataDir: "talent",
    // Deliberately empty — see CLAUDE.md's Talent-vertical section. A live
    // sample against the closest OpenAlex Topics (Human Resource and Talent
    // Management, Labor market dynamics, STEM Education, Labour Market and
    // Migration) came back a grab-bag of generic HR-management and
    // vocational-education papers, not a coherent "STEM talent" research
    // corpus the way T10682 is coherently quantum computing — checked by
    // hand 2026-07-24, only 16/25 sampled works even had institution data,
    // and most of the ones that did were off-topic (Indonesian vocational
    // pedagogy, Ghanaian youth employment). Innovation stage uses OECD
    // researcher-headcount statistics instead (see researcherStatsSince).
    openAlexFilter: "",
    researcherStatsSince: 2015,
    // Labor economics research on STEM/workforce topics is journal-first,
    // not preprint-first, unlike quantum-ph or cs.AI — econ.GN (arXiv's
    // General Economics category) is the closest real fallback if this
    // vertical's fetch path is ever changed to attempt one, though it's
    // currently unreached (openAlexFilter is "", so the OpenAlex/arXiv
    // branch is skipped entirely — see fetch-data.ts).
    arxivCategory: "econ.GN",
    // No real CPC code maps "talent"/human-capital onto a patent
    // classification the way quantum/AI do — the closest, G06Q10/1053
    // (employment/hiring software), is about HR software, not the
    // scientist/engineer pipeline. Empty string skips patents entirely
    // (see epo.ts's fetchPatents guard) rather than force a tangential fit.
    epoCpcQuery: "",
    // CFDA 47.076 is NSF's real, official funding-classification code for
    // its Education & Human Resources directorate (GRFP, S-STEM, Robert
    // Noyce, Advanced Technological Education, IUSE...) — confirmed live
    // 2026-07-24. Filtering on it instead of a free-text keyword sidesteps
    // a real problem: "STEM workforce"/"workforce" as a keyword matched
    // 281/300 sampled NSF awards, because nearly every NSF grant's
    // boilerplate broader-impacts language mentions training students —
    // the topic is too generic to isolate with a text regex the way
    // "quantum" or "artificial intelligence" can. See nsf.ts.
    fundingKeyword: "47.076",
    fundingQueryParam: "cfdaNumber",
    rssFeeds: TALENT_RSS_FEEDS,
    rssClassifier: TALENT_RSS_CLASSIFIER,
    investmentNewsQuery:
      '"STEM workforce" (grant OR funding OR "graduate research fellowship" OR "national science foundation" OR NSF)',
    // No real public-company ticker maps cleanly onto "STEM talent" the way
    // IonQ maps onto quantum or Nvidia onto AI — staffing/EdTech names
    // (ManpowerGroup, Coursera) are a weak, indirect proxy at best. Left
    // empty rather than force a tangential fit; CompanyMarketPanel just
    // doesn't render for this vertical, same soft-fail-to-absent pattern as
    // everything else here.
    tickers: [],
  },
];

export function verticalById(id: string): VerticalConfig {
  return VERTICALS.find((v) => v.id === id) ?? VERTICALS[0];
}
