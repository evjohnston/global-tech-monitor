// The vertical registry — one entry per technology tracked by this app.
// Every fetch path (scripts/fetch-data.ts, worker/, the browser live-refresh
// in App.tsx) reads its per-source query config from here, so a new vertical
// is added in exactly one place rather than four. Adding a vertical is real
// work, not a flag flip: each needs its own OpenAlex filter (checked by hand
// for institution-data quality), EPO CPC code, funding-source keyword, and
// verified RSS feeds — see CLAUDE.md's "How to extend" section.
import type { RssClassifierConfig, RssFeedConfig } from "./sources/rss.ts";
import { DEFAULT_EXCLUDE_WORDS } from "./sources/rss.ts";

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
  // Keyword for the two US federal-PROCUREMENT sources (usaSpending.ts,
  // samGov.ts), which both reused `fundingKeyword` until 2026-09-02.
  // Optional, and falling back to fundingKeyword keeps quantum/AI exactly
  // as they were — "quantum" and "artificial intelligence" are the right
  // term for NSF and for federal contracts alike. Biotechnology is the
  // first vertical where one string genuinely cannot serve both, measured
  // by hand (2026-09-02): "biomanufacturing" gets NSF right (300/300
  // returned awards pass a real biotech-technique regex, vs. 59/300 for
  // "biotechnology", whose keyword search mostly matches broader-impacts
  // boilerplate in ecology and fellowship grants) but returns ZERO from
  // both procurement APIs, while "biotechnology" returns real contracts
  // from both (a $73M HHS mRNA-vaccine development award to Moderna, a
  // $1.0M HHS "IPSC ENGINEERING SERVICES" contract to Thermo Fisher, and
  // a real DoD BAA biotechnology topic on SAM.gov). Splitting the field
  // was the honest fix; picking one term would have silently zeroed out
  // either the Investment stage or the federal-contract half of Adoption.
  procurementKeyword?: string;
  // Optional second public-funding source, filtered by the FUNDER'S OWN
  // classification of the award rather than by keyword — a CFDA program
  // number, via USASpending's assistance-award endpoint (see
  // fetchFederalGrants in sources/usaSpending.ts). Set this when NSF's
  // free-text keyword search is measurably the wrong instrument for a
  // field, which is a thing to establish by reading real returned awards,
  // not to assume.
  //
  // Space is the case that forced it. NSF funds space SCIENCE, so a "space
  // technology" keyword matches 7% of what it returns; NASA's own 43.012
  // "Space Technology" program is ~85% on-topic on a live 40-award read.
  // Both sources run when this is set — NSF is not replaced, because it
  // does return some real awards and dropping recorded history would be
  // worse than carrying a disclosed mix.
  //
  // Biotechnology is the obvious next user (NIH suits it far better than
  // NSF, per CLAUDE.md) and needs only the agency name plus real NIH
  // program numbers checked the same way. Left unset until someone does
  // that reading.
  grantAgency?: string; // USASpending awarding-agency name, exactly as spelled there
  // Which tier `grantAgency` names. Many of the most useful funders are
  // SUBTIER agencies of a parent department and return zero rows as toptier,
  // silently — NIH, BARDA and DARPA all are; NASA is a toptier itself.
  // Look the exact string up via USASpending's
  // /api/v2/autocomplete/awarding_agency/ rather than guessing it.
  grantAgencyTier?: "toptier" | "subtier";
  grantProgramNumbers?: string[]; // CFDA program numbers, e.g. ["43.012"]
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

// Biotech trade press verified by hand (2026-09-02): each returns valid
// RSS 2.0 XML from a real, actively-publishing outlet, checked by curl for
// item count and date format. Only biopharmadive.com sends an open
// Access-Control-Allow-Origin — the rest would need the Worker proxy if the
// browser ever fetched these again (it doesn't, see CLAUDE.md's "Live
// data"). Four more real candidates were checked and rejected rather than
// added: endpts.com (Endpoints News) and genomeweb.com both return 403 to a
// script, biospace.com and synbiobeta.com have no working feed at any of
// the usual paths, and nature.com's own biotechnology subject feed and
// nbt.rss are journal tables-of-contents (empty <description>, RSS 1.0/RDF
// in nbt's case) rather than trade press — those are the Innovation
// stage's job via OpenAlex, and running them through a scaling/adoption
// classifier would file research papers as manufacturing milestones.
//
// Fierce Biotech's pubDate format ("Sep 2, 2026 10:29am") is the reason
// parseDate in rss.ts grew a fallback — see the comment there.
const BIOTECH_RSS_FEEDS: RssFeedConfig[] = [
  { url: "https://www.fiercebiotech.com/rss/xml", name: "Fierce Biotech", corsOpen: false },
  { url: "https://www.biopharmadive.com/feeds/news/", name: "BioPharma Dive", corsOpen: true },
  { url: "https://www.genengnews.com/feed/", name: "Genetic Engineering & Biotechnology News", corsOpen: false },
  { url: "https://www.labiotech.eu/feed/", name: "Labiotech", corsOpen: false },
  { url: "https://www.drugdiscoverytrends.com/feed/", name: "Drug Discovery Trends", corsOpen: false },
];

// Biotech's equivalent of "qubit count" is litres of validated bioreactor
// capacity and doses per year; its equivalent of "deploy a quantum
// computer" is a regulator clearing a product for real use. Tuned against
// a real fetch of all five feeds above (2026-09-02), same as quantum's and
// AI's classifiers.
//
// The honest headline about this classifier: its yield is LOW, roughly 4
// classified items out of ~100 fetched across the five feeds, and that is
// correct rather than broken. Biotech trade press is overwhelmingly
// clinical-trial readouts, licensing deals, M&A, layoffs and drug-pricing
// politics — all real news, none of it a production-scaling or adoption
// milestone in this app's sense. The `exclude` extension below drops those
// categories explicitly instead of letting a stray "phase 3" or "$2.9B
// buyout" headline land in a stage it doesn't belong in. data/biotech/
// seed.ts is doing the real work for these two stages here, more so than
// for either other vertical; don't loosen these patterns to make the
// number go up without reading the actual `rss-*` entries it produces.
const BIOTECH_RSS_CLASSIFIER: RssClassifierConfig = {
  relevant:
    /\b(biotech\w*|biopharma\w*|synthetic\s+biolog\w+|CRISPR|Cas9|Cas12|Cas13|base\s+edit\w+|prime\s+edit\w+|gene\s+(?:therap\w+|editing|drive|delivery|silencing)|genome\s+(?:editing|engineering|sequencing)|cell\s+therap\w+|CAR[-\s]?T|TCR[-\s]?T|mRNA|siRNA|RNAi|RNA\s+therapeut\w+|antisense|oligonucleotide|monoclonal|antibod\w+|bispecific|biologics?|biosimilar\w*|vaccine\w*|immunotherap\w+|bioreactor\w*|bioprocess\w*|biomanufactur\w+|fermentation|biocataly\w+|protein\s+(?:design|engineering)|directed\s+evolution|stem\s+cell\w*|induced\s+pluripotent|iPSCs?|tissue\s+engineer\w+|regenerative\s+medicine|organoids?|bioprint\w+|genomics?|proteomics?|transcriptomics?|microbiome|biosensors?|molecular\s+diagnostics?|companion\s+diagnostics?|liquid\s+biopsy|cultivated\s+meat|biofoundry|biosecurity|biodefense|bioeconomy)\b/i,
  scaling:
    /\b(bioreactor\w*|bioprocess\w*|biomanufactur\w+|manufactur\w+\s+(?:scale|scaleup|capacity|facility|plant|site|network|expansion|agreement|partnership)|scale[-\s]?up|scaling\s+up|\bGMP\b|\bcGMP\b|fill[-\s]finish|single[-\s]use\b|\bCDMO\b|contract\s+manufactur\w+|production\s+(?:capacity|facility|line|plant)|commercial[-\s]scale|facility\s+(?:opens?|expansion|expands?)|breaks?\s+ground|process\s+(?:development|control|intensification)|continuous\s+(?:manufactur\w+|bioprocess\w*)|precision\s+fermentation|cell\s+line\s+develop\w+|tech(?:nology)?\s+transfer|sequencing\s+(?:throughput|cost)|cost\s+per\s+genome|doses\s+(?:a|per)\s+year|litres?\s+of\s+capacity)\b/i,
  adoption:
    /\b(FDA\s+(?:approv\w+|clear\w+|OKs?|authoriz\w+)|EMA\s+approv\w+|\bCHMP\b|marketing\s+authori[sz]ation|regulatory\s+(?:approval|clearance)|\bNMPA\b|\bMHRA\b|\bCDSCO\b|\bPMDA\b|(?:approves?|approved|clears?|authoris\w+|authoriz\w+)\s+(?:the\s+)?(?:first\s+)?(?:\S+\s+){0,3}(?:gene\s+therap\w+|cell\s+therap\w+|vaccine\w*|biosimilar\w*|CAR[-\s]?T)|first\s+patient|commercial\s+launch|\bBARDA\b|reimburse\w+|formulary|\bNHS\b|procure\w+|government\s+contract|awarded?\s+(?:a\s+)?contract|national\s+(?:biotech\w*|genom\w+|bioeconomy|vaccine|immuni[sz]ation)\s+(?:strategy|initiative|program\w*|mission)|stockpil\w+|adopt(?:s|ed|ion)\b|deploy\w+|rolls?\s+out|WHO\s+prequalif\w+)\b/i,
  // Extends DEFAULT_EXCLUDE_WORDS rather than replacing it (see
  // RssClassifierConfig) — the generic personnel/podcast/funding-round
  // noise filter still applies. Everything added here is a real category
  // of biotech headline that this app deliberately does not track, each
  // one confirmed against actual dropped items from the 2026-09-02 fetch:
  // clinical readouts ("Alumis' TYK2 drug fails in key lupus study",
  // "Teva autoimmune antibody notches ph. 2 win"), M&A ("Lilly adds to
  // immune drug pipeline with $2.9B Merida buyout"), layoffs ("TScan axes
  // 75% of workforce"), device recalls, and drug-pricing politics.
  exclude: new RegExp(
    DEFAULT_EXCLUDE_WORDS.source +
      "|\\b(layoffs?|axes?\\s+\\d|sheds?\\s+(?:most\\s+of\\s+)?staff|cuts?\\s+\\d+%|workforce|layoff\\s+tracker" +
      "|recalls?|halts?\\s+sales|lawsuit|patent\\s+dispute|settles?\\s+|buyout|acquisitions?|acquires?|to\\s+acquire|merger" +
      "|funding\\s+rounds?|\\bIPO\\b|phase\\s+[123]\\b|\\bph\\.\\s*\\d|midstage|readouts?|trial\\s+(?:fails?|flop|win)" +
      "|flops?|misses?\\s+(?:its\\s+)?(?:primary\\s+)?endpoint|top-?line\\s+(?:data|results)|deep\\s+dive" +
      // A trial readout for a BIOLOGIC passes the `relevant` gate (it names
      // an antibody, a gene therapy, a vaccine) where a small-molecule one
      // doesn't, so the readout patterns above aren't enough on their own —
      // "Alumis' TYK2 drug fails in key lupus study" only got dropped
      // because it failed relevance, and the same sentence about a
      // monoclonal would have sailed through.
      "|(?:drug|therapy|therapies|candidate|vaccine|antibody|inhibitor)\\s+(?:fails?|failed|flops?|misses?|beats?)" +
      "|cyberattack|insider\\s+trading|drug\\s+pricing)\\b",
    "i"
  ),
};

// Space trade press verified by hand (2026-09-02): all six return valid
// RSS 2.0 from real, actively-publishing outlets, curl-checked for item
// count and date format. Only payloadspace.com sends an open
// Access-Control-Allow-Origin. Four more were checked and left out rather
// than added for volume: space.com is consumer astronomy (50 items/fetch,
// mostly sky-watching and science explainers), arstechnica.com/space is
// good journalism but a general-tech outlet, teslarati.com is SpaceX fan
// coverage, and spaceflightnow.com is largely a launch schedule. The six
// kept are the industry papers of record plus one policy outlet, which
// matters for this app's audience.
const SPACE_RSS_FEEDS: RssFeedConfig[] = [
  { url: "https://spacenews.com/feed/", name: "SpaceNews", corsOpen: false },
  { url: "https://payloadspace.com/feed/", name: "Payload", corsOpen: true },
  { url: "https://www.nasaspaceflight.com/feed/", name: "NASASpaceflight", corsOpen: false },
  { url: "https://europeanspaceflight.com/feed/", name: "European Spaceflight", corsOpen: false },
  { url: "https://www.satellitetoday.com/feed/", name: "Via Satellite", corsOpen: false },
  { url: "https://spacepolicyonline.com/feed/", name: "SpacePolicyOnline", corsOpen: false },
];

// Space's equivalent of "qubit count" is a vehicle, platform or payload
// reaching a real technical milestone; its equivalent of "deploy a quantum
// computer" is a contract award, a launch under contract, or a national
// policy actually committing money. Tuned against a real fetch of all six
// feeds (2026-09-02).
//
// `relevant` deliberately never matches a bare "space" — "state space",
// "parameter space" and "disk space" are all common, and this gate is
// reused by nsf.ts against grant abstracts where that would be constant
// noise. Every "space" alternative below is bound to a space-domain word.
const SPACE_RSS_CLASSIFIER: RssClassifierConfig = {
  relevant:
    /\b(spacecraft|space\s*(?:craft|flight|port|borne)|space\s+(?:mission|station|telescope|debris|situational|domain|launch|systems?|agency|exploration|force|policy|economy)|satellite\w*|orbital|orbiter|in[-\s]orbit|on[-\s]orbit|launch\s+(?:vehicle|provider|site|contract)|launcher|rocket\w*|booster|propulsion|thruster|CubeSat|SmallSat|smallsat|constellation|payload|cislunar|lunar|Artemis|deorbit|reentry|ground\s+station|NASA|ESA\b|Space\s+Force|spaceport|Starlink|Starship|Ariane|Falcon\s+9|Earth\s+observation|GNSS|VLEO|\bLEO\b|\bGEO\b)\b/i,
  scaling:
    /\b(first\s+(?:flight|launch|light)|maiden\s+flight|static\s+fire|hot\s+fire|engine\s+test|test\s+flight|qualification\s+(?:test|campaign)|critical\s+design\s+review|\bCDR\b|unveils?|introduces?|debuts?|new\s+(?:platform|bus|engine|stage|variant)|mass[-\s]produc\w+|production\s+(?:rate|line|facility)|factory|manufactur\w+\s+(?:facility|site|expansion|scale)|assembly\s+line|reusab\w+|refurbish\w+|in[-\s]orbit\s+(?:manufactur\w+|servicing|assembly)|constellation\s+(?:buildout|expansion)|upgrade[sd]?|cadence)\b/i,
  adoption:
    /\b(awards?\s+\S+|awarded|wins?\s+(?:a\s+)?(?:\$|€|£)?\S*\s*(?:contract|award|order)|selects?|selected\s+(?:by|for)|contract\s+(?:award|win|worth)|procure\w+|order[sd]?\s+\d|signs?\s+(?:an?\s+)?(?:agreement|contract|deal|MOU)|operational|enters?\s+service|begins?\s+(?:service|operations)|deploy\w+|licen[cs]e[sd]?|regulator\w*\s+approv\w+|national\s+space\s+(?:strategy|policy|programme|program)|space\s+policy|executive\s+order|budget\s+request|appropriat\w+)\b/i,
  // Extends DEFAULT_EXCLUDE_WORDS. Each pattern traces to a real dropped
  // headline from the 2026-09-02 fetch: recurring policy roundups
  // ("What's Happening in Space Policy August 30-September 5"), trade-body
  // membership notices ("Commercial Space Federation Welcomes Two New
  // Associate Members"), honorary appointments ("Tory Bruno Named Honorary
  // Chair Of World Space Week"), sponsored/opinion columns SpaceNews runs
  // alongside news ("Propulsion is having a moment", "Speed to Field
  // Starts Below the Prime"), analyst reports, and office openings.
  exclude: new RegExp(
    DEFAULT_EXCLUDE_WORDS.source +
      "|\\b(what.s\\s+happening|welcomes\\s+\\S+\\s+(?:new\\s+)?(?:member|associate)|associate\\s+members?" +
      "|honorary|named\\s+\\S+\\s+chair|world\\s+space\\s+week|ribbon\\s+cutting" +
      "|report\\s+finds|study\\s+finds|analysts?\\s+say|opinion|commentary|sponsored" +
      "|opens?\\s+\\S+\\s+offices?|is\\s+having\\s+a\\s+moment)\\b",
    "i"
  ),
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
  {
    id: "biotechnology",
    number: "03",
    label: "Biotechnology",
    shortLabel: "Biotech",
    tagline: "Biotechnology · innovation, scaling, adoption, investment",
    dataDir: "biotech",
    // Biotechnology has the same problem AI has, worse. OpenAlex ships a
    // subfield literally called "Biotechnology" (1305) and it is a
    // grab-bag: hand-checked all 8 of its topics (2026-09-02) and found
    // Listeria monocytogenes in food safety (34.7k works), marine sponges
    // and natural products (42.3k), and microbial inactivation methods
    // (35.6k). Its sibling "Applied Microbiology and Biotechnology" (2402)
    // is antibiotic resistance plus one topic on tannase. Neither is the
    // technology. Worse, the most biotech-sounding topic in the whole
    // 4,516-topic list, T14293 "Biotechnology and Related Fields", turned
    // out on a live sample to be Nature/Science news copy — "Trump
    // administration has its sights set on destroying international
    // research collaborations", "India heatwave", "Twistronics founders win
    // 2026 Kavli Prize" — and had the worst institution-country coverage of
    // anything sampled (7/12). Excluded for that reason, not by name.
    //
    // So this is an explicit OR'd list of 33 topics, each one checked
    // against its own real recent journal works before being kept, grouped
    // by what they actually cover: engineering biology (T10878 CRISPR,
    // T10932 metabolic engineering/synthetic biology, T10120 bacterial
    // genetics, T12856 transgenic plants, T11048 bacteriophages, T12673
    // microbial metabolism); therapeutic modalities (T10613 viral gene
    // therapy, T10725 RNAi/gene delivery, T11491 CAR-T, T10505 pluripotent
    // stem cells, T10176 mesenchymal stem cells, T12264 tissue
    // engineering, T10063 nanoparticle drug delivery, T12576 vaccines/
    // immunoinformatics); protein and biomolecular engineering (T10044
    // protein structure/dynamics, T11016 antibodies — whose real works are
    // de novo protein design despite OpenAlex filing it under Radiology,
    // T11162 enzyme structure, T10404 enzyme immobilisation, T10432
    // nucleic-acid chemistry); measurement platforms (T10015 genomics,
    // T11289 single-cell/spatial transcriptomics, T10519 proteomics,
    // T10836 metabolomics, T10887 + T10621 + T13937 bioinformatics,
    // T12254 ML in bioinformatics, T10211 computational drug discovery,
    // T11287 cancer genomics/liquid biopsy, T11642 clinical genomics,
    // T10207 + T12867 biosensing); and biosecurity (T11515).
    //
    // Deliberately EXCLUDED after checking their real works, each for a
    // stated reason rather than by vibe: T10240 plant tissue culture
    // (orchid micropropagation, not frontier), T11617 enzyme production
    // (wheat-starch food science), T10171 biofuel production and T11882
    // terpenoid biosynthesis and T14285 biopolymers (biomass energy and
    // food chemistry — excluding them keeps this consistent with how the
    // CapIQ VC data for this vertical is scoped, which drops Commodity
    // Chemicals and Packaged Foods for the same reason, see CLAUDE.md),
    // T10252 microbial natural products and T11103
    // antimicrobial peptides (natural-product chemistry), T10412/T11255/
    // T11407 microfluidics (fuel-cell and channel-mixing fluid mechanics),
    // T12654 xenotransplantation (veterinary immunology on a live sample),
    // T10580 immunotherapy and T10873 bacterial vaccines and T10269
    // epigenetics (clinical/basic biology, not platform), T10059 bone
    // tissue engineering and T11966 silk (biomaterials chemistry),
    // T11393 biosensors (food-pathogen detection), T12029 DNA computing
    // (4 of 6 sampled works off-topic), T10920 drug delivery systems
    // (pharmaceutical formulation).
    //
    // Net result on a live 30-day journal-only sample (2026-09-02): 9,784
    // works matched, 50/50 with structured institution-country data — the
    // cleanest attribution of any vertical in this app, better than AI's
    // 96% and far better than quantum's — across 35 distinct countries in
    // that 50-work sample.
    openAlexFilter:
      "topics.id:T10878|T10932|T10120|T12856|T11048|T12673|T10613|T10725|T11491|T10505|T10176|T12264|T10063|T12576|T10044|T11016|T11162|T10404|T10432|T10015|T11289|T10519|T10836|T10887|T10621|T13937|T12254|T10211|T11287|T11642|T10207|T12867|T11515",
    // q-bio.BM (Biomolecules) is arXiv's closest general-biotech archive —
    // checked live, it returns real cryo-EM/RNA-biophysics preprints, and
    // the bare deprecated `q-bio` category only has 1,356 works total.
    // Same break-glass role as quant-ph and cs.AI: only reached if OpenAlex
    // itself is unreachable.
    arxivCategory: "q-bio.BM",
    // The three real biotech CPC subclasses, verified against USPTO's own
    // CPC definitions and then run live against EPO OPS (2026-09-02):
    // C12N (microorganisms/enzymes/cells, and at C12N15 genetic
    // engineering and recombinant DNA), C12Q (measuring and testing
    // involving enzymes, nucleic acids or microorganisms — the diagnostics
    // subclass), C12P (fermentation and enzyme-using processes to
    // synthesise compounds). Together they returned 642,459 results whose
    // newest 25 were exactly right: Intellia's BCMA CAR-T compositions,
    // Arbor Biotechnologies' gene-editing system, circular RNA delivery,
    // Sophia Genetics' variant detection, University of Washington's
    // cell-free bioproduction. C07K (peptides) was checked too and left
    // out — it adds ~150k results but drifts into pure peptide-synthesis
    // organic chemistry ("Procédé de synthèse de peptides" was the top
    // hit), which isn't this vertical.
    epoCpcQuery: "cpc=C12N OR cpc=C12Q OR cpc=C12P",
    // "biomanufacturing", not "biotechnology" — measured, not preferred.
    // NSF's keyword search is loose enough that "biotechnology" mostly
    // matches broader-impacts boilerplate: of 300 returned awards only 59
    // named an actual biotech technique ($35.2M of $200.8M obligated), the
    // rest being squid hydrodynamics, wild-bee heat resilience and EPSCoR
    // fellowship programmes that mention biotech once as a downstream
    // benefit. "biomanufacturing" returned 300 of 300 on-topic ($403.2M),
    // real ones — an SBIR energy-efficient fermentation platform, PURE
    // cell-free expression benchmarking, nanopore QC for adenoviral gene
    // therapy, light-controlled proteins for sustainable biomanufacturing.
    // The honest cost: this covers the bioengineering/biomanufacturing
    // slice of NSF's biotech portfolio rather than all of it. Disclosed in
    // data/biotech/notes.ts's investment note rather than papered over.
    fundingKeyword: "biomanufacturing",
    // ...and "biotechnology" for federal procurement, where the reverse is
    // true: "biomanufacturing" returns ZERO from both USASpending and
    // SAM.gov, while "biotechnology" returns real contracts from both. See
    // the field's own comment above for the measured numbers.
    procurementKeyword: "biotechnology",
    // BARDA, via its parent office's subtier name. Added 2026-09-04 after
    // testing NIH first and rejecting it. NIH is a poor fit for THIS
    // vertical's scope rather than a bad source: its largest assistance
    // awards are clinical-trial networks (HIV vaccine, AIDS Clinical
    // Trials Group) and state capacity-building consortia (IDeA/INBRE),
    // and its bioengineering program 93.286 is point-of-care medical
    // devices — the identical trap that made the first CapIQ biotech
    // import a table about surgical robots.
    //
    // BARDA's 93.360 instead funds exactly what this vertical says it
    // tracks. Verified live: 43 awards, $1.38B, complete in one page, led
    // by BSL-1 and BSL-2 industrial base expansion (Jubilant HollisterStier,
    // Curia, Grand River Aseptic), Croda's lipid capacity, TriLink's
    // ribonucleotide triphosphates for mRNA, Gerresheimer vial fill-finish,
    // ARMI regenerative manufacturing, NC State's biomanufacturing training
    // centre, CARB-X, and a $25.4M influenza-vaccine production award to the
    // WHO. Roughly 18-20 of the top 25 are squarely biomanufacturing
    // capacity or biosecurity; the residual is a couple of clinical trials.
    //
    // Additive, not corrective. Unlike space, biotech's NSF query is
    // already good (300/300 on-topic on "biomanufacturing"), so this widens
    // a narrow-but-accurate picture rather than replacing a wrong one.
    grantAgency: "Office of Assistant Secretary for Preparedness and Response",
    grantAgencyTier: "subtier",
    grantProgramNumbers: ["93.360"],
    rssFeeds: BIOTECH_RSS_FEEDS,
    rssClassifier: BIOTECH_RSS_CLASSIFIER,
    // ARPA-H and BARDA are in here because they're the two US agencies that
    // actually show up in real biotech funding headlines the way NSF shows
    // up for quantum — checked by hand (2026-09-02) against real feed
    // output, e.g. STAT's "ARPA-H funds biotechs working on custom RNA
    // therapies".
    investmentNewsQuery:
      '(biotechnology OR biomanufacturing OR "gene therapy" OR "synthetic biology") (grant OR funding OR investment OR NSF OR ARPA-H OR BARDA OR "national biotechnology")',
    // 70 tickers, every one confirmed live against Massive's own reference
    // endpoint (2026-09-02) to actually carry market-cap data — 79 real
    // candidates were checked, and the 9 that didn't make it are recorded
    // here rather than dropped silently:
    //   - RHHBY (Roche) and NVZMY (Novonesis) resolve but carry NO market
    //     cap on this plan tier, the same foreign-OTC-ADR problem quantum
    //     and AI hit. Both are genuinely major (Roche is one of the
    //     world's largest biologics manufacturers; Novonesis is the
    //     largest industrial-enzyme company) so they belong in a future
    //     data/capiq/rd-spend.ts export the way BAESY/TCEHY/SSNLF did —
    //     the current export predates this vertical and has neither, so
    //     there's no CAPIQ_TICKERS_BY_VERTICAL entry for biotechnology yet.
    //   - EXAS (Exact Sciences) 404s outright, consistent with a
    //     delisting; DNAY was a bad guess and isn't a real symbol.
    //   - IFF, IQV and WST resolve with real market caps and were still
    //     left out on scope: flavors-and-fragrances chemicals, clinical-
    //     trial services/data, and injectable packaging components are
    //     each adjacent to biotech without being it. Including them would
    //     have made the R&D-spend chart worse for no analytical gain.
    //
    // Note RNA resolves to Atrium Therapeutics, not Avidity Biosciences —
    // Avidity's old symbol, now carried by a real RNA-therapeutics
    // company. Kept deliberately, flagged so nobody reads it as Avidity.
    //
    // Same R&D-attribution caveat as quantum's and AI's lists, and it
    // splits cleanly here: for the pure-plays (CRSP through VCEL, plus the
    // sequencing and synthetic-biology names) SEC-EDGAR R&D spend really
    // IS biotech R&D, which is not true of either other vertical. For the
    // twelve large-pharma names and the nine life-science-tools names it
    // is total corporate R&D — Eli Lilly's R&D is mostly small molecules,
    // Thermo Fisher's is instruments for every market it serves. See
    // CLAUDE.md's "Known tension" note under the public-markets panel.
    tickers: [
      "CRSP", "NTLA", "BEAM", "EDIT", "CRBU", "SRPT", "RARE", "KRYS", // gene editing + gene therapy pure-plays
      "ALNY", "IONS", "ARWR", "RNA", // RNA / oligonucleotide therapeutics
      "MRNA", "BNTX", "NVAX", // mRNA vaccines
      "LEGN", "IOVA", "ALLO", "SANA", "FATE", "VCEL", // cell therapy
      "REGN", "VRTX", "AMGN", "GILD", "BIIB", "ZLAB", // large-cap biotech
      "RXRX", "SDGR", "ABSI", "TEM", // computational drug discovery + protein design
      "DNA", "TWST", "CDXS", // synthetic biology, DNA synthesis, enzyme engineering
      "ILMN", "PACB", "TXG", "QTRX", "SEER", "NAUT", // sequencing + omics platforms
      "NTRA", "GH", "MYGN", "QGEN", "SOPH", "GRAL", // molecular diagnostics
      "TMO", "DHR", "A", "RVTY", "BIO", "WAT", "BRKR", "RGEN", "CRL", // life-science tools + bioprocessing
      "LLY", "PFE", "MRK", "JNJ", "ABBV", "BMY", "AZN", "NVS", "SNY", "GSK", "NVO", "TAK", // large pharma, documented biologics/vaccine/gene-therapy franchises
      "ZTS", "CTVA", "BIOX", // animal-health and agricultural biotech
    ],
  },
  {
    id: "space",
    number: "04",
    label: "Space Technologies",
    shortLabel: "Space",
    tagline: "Space technologies · innovation, scaling, adoption, investment",
    dataDir: "space",
    // The scoping decision that defines this vertical: it tracks space
    // TECHNOLOGY — launch, propulsion, spacecraft, satellites and their
    // comms, on-orbit operations, space traffic and debris — and NOT
    // astronomy or planetary science, which are science ABOUT space. That
    // is the same call biotechnology makes in excluding clinical medicine,
    // and it is what keeps this corpus at ~550 works a month instead of
    // being swamped: OpenAlex's "Astronomy and Astrophysics" subfield
    // (3103) alone holds 2.18 MILLION works, four times the entire
    // aerospace subfield.
    //
    // Only five topics survived a hand-check of their real recent journal
    // works, and the rejects matter more here than in any other vertical
    // because OpenAlex's aerospace taxonomy blends space with aviation,
    // marine and general engineering:
    //   T12042 Satellite Communication Systems — 6/6 on-topic (free-space
    //     optical comms, Starlink governance, space traffic management,
    //     LEO constellations)
    //   T11701 Space Satellite Systems and Control — 6/6 (Lunar
    //     Trailblazer recovery, spacecraft guidance, orbital debris)
    //   T12449 Spacecraft Design and Technology — co-orbital configs,
    //     small-satellite propulsion, lunar orbit propagators
    //   T12513 Rocket and propulsion systems — scramjet cooling,
    //     rocket-based combined cycle, reusable launch trajectories
    //   T12717 Space exploration and regulation — the policy topic, and
    //     uniquely valuable for this app's audience (Starlink governance,
    //     space traffic management, satnav-spoofing liability, "From
    //     Sputnik to Starship: the experience curve of space launch")
    //
    // Deliberately EXCLUDED after reading their real works, each for a
    // stated reason. Named like space, isn't: T14214 "Space Exploration
    // and Technology" is planetary science (lunar crustal formation,
    // Mercury's exosphere, meteorite spectra) — the same trap as
    // biotechnology's T14293. T10406 "Planetary Science and Exploration"
    // likewise. Aviation, not space: T12125 (pilot workload, helicopter
    // training), T12719 (airships, flapping-wing robots), T13855 (generic
    // control theory, and one paper on whether the upwardly mobile are
    // left-wing). Earth science using satellites rather than building
    // them: T10801 and T11038 SAR (landslides, aquifers, tree height),
    // T10655 GNSS (earthquake magnitude, ionospheric scintillation).
    // Defence/energetics rather than launch: T12699 electromagnetic
    // launch (ceramic armour, battery thermal runaway), T12389 infrared
    // targets, T13371 military systems. Half-noise, so dropped rather
    // than diluting: T13200 spacecraft/cryogenic (submerged floating
    // tunnels, ship anti-rolling tanks) and T11082 spacecraft dynamics
    // (unmanned SURFACE vehicles, airship sizing) — adding both raised
    // the 30-day count from 546 to 813 but REDUCED the distinct countries
    // in a 50-work sample from 29 to 21, which is the tell that the extra
    // volume is concentrated noise.
    //
    // Live 30-day journal-only result: 546 works, 46/50 with structured
    // institution-country data, 29 distinct countries in that sample.
    // Comparable in size to quantum's 727 — space technology really is a
    // smaller literature than AI or biotech, not an under-scoped filter.
    openAlexFilter: "topics.id:T12042|T11701|T12449|T12513|T12717",
    // astro-ph.IM is arXiv's instrumentation-and-methods astrophysics
    // archive — the closest thing arXiv has to a space-engineering
    // section. Break-glass only, same as every other vertical's.
    arxivCategory: "astro-ph.IM",
    // B64G is the real space CPC subclass and its own USPTO definition
    // does the aviation/space split for us: it "covers only vehicles,
    // equipment or the like specially adapted for cosmonautics" and
    // explicitly excludes anything applicable to both cosmonautics and
    // aeronautics. Verified live (2026-09-02): 25,876 results whose
    // newest were Viasat satellite stowage/deployment, a Blue Origin
    // cryogenic boiler, an Argotec microsatellite, an ArianeGroup
    // propulsion system and a Honeybee Robotics payload unloader — 7/7
    // on-topic. H04B7/185 (space-based and satellite stations) adds ~2,000
    // real satellite-communications filings. G01S19 (GNSS receivers) was
    // tested and rejected: it takes the total to 90,704 and the top hits
    // become Nokia non-terrestrial-network positioning and Google GNSS,
    // i.e. terrestrial telecom rather than space technology.
    epoCpcQuery: "cpc=B64G OR cpc=H04B7/185",
    // NSF is a genuinely poor fit for this vertical and the number should
    // be read that way. Measured 2026-09-02: NSF funds space SCIENCE, not
    // space technology — space weather, magnetospheric plasma, solar
    // energetic particles, and Earth science that consumes satellite data
    // (cloud evolution, wildfire detection, soil moisture). Querying
    // "satellite" returns 300 awards that are almost entirely Earth
    // scientists USING satellite data; "orbital" matches molecular
    // orbitals in chemistry; "space technology" matches only 7%.
    // "spacecraft" is the least-bad option and still returns
    // broader-impacts boilerplate. The right source is NASA (TechPort or
    // NSPIRES) or DoD SBIR, neither of which this app has a module for —
    // an honest gap, stated in data/space/notes.ts rather than papered
    // over, and the Investment stage here leans on procurement and the
    // CapIQ VC panel instead.
    fundingKeyword: "spacecraft",
    // Procurement is where this vertical's public money actually shows up,
    // and "satellite" is the term that finds it. Verified live against
    // USASpending: Northrop's $575.3M Joint Polar Satellite System-2
    // spacecraft, Rocket Lab's NASA VCLS contract, Maxar's Commercial
    // Satellite Data Acquisition award — all real, all NASA or DoD.
    // "spacecraft" as a procurement term finds JWST for Northrop but
    // nothing for Rocket Lab or Maxar.
    procurementKeyword: "satellite",
    // NASA's Space Technology Mission Directorate grant program. Verified
    // live 2026-09-04: 100 awards worth $222M whose top 40 are real
    // technology development — ultra-strong composites, deep-space PNT,
    // in-space propellant transfer, regolith beneficiation, cold-tolerant
    // lunar electronics, CubeSat laser crosslinks. Compare 43.001 Science
    // at $805M in five rows, which is the thing being excluded.
    grantAgency: "National Aeronautics and Space Administration",
    grantProgramNumbers: ["43.012"],
    rssFeeds: SPACE_RSS_FEEDS,
    rssClassifier: SPACE_RSS_CLASSIFIER,
    investmentNewsQuery:
      '(space OR satellite OR "launch vehicle") (grant OR funding OR investment OR contract OR NASA OR "Space Force" OR "national space")',
    // Grouped to match the sector values in companyCategory.ts. The
    // exposure split is unusually clean in this vertical: the launch and
    // satellite-operator names are genuine pure-plays whose entire R&D
    // really is space, while the primes are the opposite extreme —
    // Lockheed's and Boeing's total R&D is overwhelmingly not space, and
    // the R&D chart's sector chips exist so a reader can separate the two.
    // 35 tickers, each confirmed live against Massive's reference endpoint
    // (2026-09-02) to actually carry market-cap data. Of 44 candidates:
    //   - EADSY (Airbus), THLLY (Thales) and RYCEY (Rolls-Royce) resolve
    //     but carry no market cap on this plan tier, the same foreign-ADR
    //     gap quantum and AI hit. Airbus and Thales are already in
    //     data/capiq/rd-spend.ts, so they're picked up for the R&D chart
    //     via CAPIQ_TICKERS_BY_VERTICAL instead — see fetch-data.ts.
    //   - SATS (EchoStar), MAXR (Maxar, taken private 2023), AJRD (Aerojet
    //     Rocketdyne, acquired by L3Harris 2023), ASTR (Astra, delisted)
    //     and MDALF (MDA, TSX-only) don't resolve at all.
    // ARQQ resolves and is genuinely space-adjacent but stays in quantum's
    // list only — it's a quantum-encryption company that happens to sell
    // to satellite operators, and double-listing it would double-count its
    // R&D across two verticals.
    tickers: [
      "RKLB", "LUNR", "RDW", "SPCE", "MNTS", "VOYG", "SIDU", // launch and in-space services
      "ASTS", "PL", "BKSY", "SPIR", "VSAT", "IRDM", "GSAT", "TSAT", // satellite operators and Earth-observation data
      "LMT", "NOC", "RTX", "BA", "GD", "LHX", "LDOS", "HII", "KTOS", "AVAV", "TXT", "ESLT", // defense and aerospace primes with documented space programs
      "HEI", "TDG", "ATRO", "CW", "TDY", "BWXT", "HWM", "TRMB", // components, subsystems and space nuclear
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
