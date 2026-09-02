// Real, hand-researched ticker categorization — this was already done once
// (see the comments above each vertical's `tickers` array in verticals.ts,
// e.g. "pure-play quantum hardware/software," "defense/aerospace,
// documented quantum programs") but only existed as prose, not queryable
// data. Transcribed here verbatim from that research, not re-derived or
// guessed — every ticker below is placed in the exact group its own
// verticals.ts comment already puts it in.
export type ExposureClass = "pure-play" | "major-supplier" | "platform-provider" | "user-adopter" | "diversified";
export const EXPOSURE_LABEL: Record<ExposureClass, string> = {
  "pure-play": "Pure-play",
  "major-supplier": "Major supplier",
  "platform-provider": "Platform provider",
  "user-adopter": "User or adopter",
  diversified: "Diversified exposure",
};

// Sector values are per-vertical by nature — "semiconductors" is a real
// grouping for quantum and AI and meaningless for biotechnology, which
// needs its own five. They share one union rather than one-union-per-
// vertical because `tickerProfile` is a single lookup and the chip list
// that renders them is now derived from what a vertical actually uses (see
// rdSectorsFor below), so an unused value costs nothing and never shows up
// as an empty chip.
export type RdSector =
  | "pure-play" | "semiconductors" | "software-platforms" | "defense-aerospace" // quantum + AI
  | "biotech-therapeutics" | "biotech-platforms" | "life-science-tools" | "large-pharma" | "agri-animal-biotech" // biotechnology
  | "all";
export const RD_SECTOR_LABEL: Record<RdSector, string> = {
  "pure-play": "Pure-play companies",
  semiconductors: "Semiconductors",
  "software-platforms": "Software and platforms",
  "defense-aerospace": "Defense and aerospace",
  "biotech-therapeutics": "Therapeutics",
  "biotech-platforms": "Engineering-biology platforms",
  "life-science-tools": "Tools, bioprocessing and diagnostics",
  "large-pharma": "Large pharma",
  "agri-animal-biotech": "Agricultural and animal biotech",
  all: "All tracked companies",
};

interface TickerProfile {
  exposure: ExposureClass;
  sector: Exclude<RdSector, "all">;
  evidence: string;
}

// From verticals.ts's quantum tickers comment groups.
const QUANTUM: Record<string, TickerProfile> = {
  IONQ: { exposure: "pure-play", sector: "pure-play", evidence: "Pure-play quantum hardware/software" },
  RGTI: { exposure: "pure-play", sector: "pure-play", evidence: "Pure-play quantum hardware/software" },
  QBTS: { exposure: "pure-play", sector: "pure-play", evidence: "Pure-play quantum hardware/software" },
  QUBT: { exposure: "pure-play", sector: "pure-play", evidence: "Pure-play quantum hardware/software" },
  ARQQ: { exposure: "pure-play", sector: "pure-play", evidence: "Pure-play quantum hardware/software" },
  LAES: { exposure: "pure-play", sector: "pure-play", evidence: "Pure-play quantum hardware/software" },
  IBM: { exposure: "platform-provider", sector: "software-platforms", evidence: "Large incumbent, named quantum program" },
  GOOGL: { exposure: "platform-provider", sector: "software-platforms", evidence: "Large incumbent, named quantum program" },
  MSFT: { exposure: "platform-provider", sector: "software-platforms", evidence: "Large incumbent, named quantum program" },
  AMZN: { exposure: "platform-provider", sector: "software-platforms", evidence: "Large incumbent, named quantum program" },
  HON: { exposure: "platform-provider", sector: "software-platforms", evidence: "Large incumbent, named quantum program" },
  INTC: { exposure: "platform-provider", sector: "software-platforms", evidence: "Large incumbent, named quantum program" },
  NVDA: { exposure: "platform-provider", sector: "software-platforms", evidence: "Large incumbent, named quantum program" },
  LMT: { exposure: "user-adopter", sector: "defense-aerospace", evidence: "Defense/aerospace, documented quantum program" },
  NOC: { exposure: "user-adopter", sector: "defense-aerospace", evidence: "Defense/aerospace, documented quantum program" },
  RTX: { exposure: "user-adopter", sector: "defense-aerospace", evidence: "Defense/aerospace, documented quantum program" },
  GD: { exposure: "user-adopter", sector: "defense-aerospace", evidence: "Defense/aerospace, documented quantum program" },
  LHX: { exposure: "user-adopter", sector: "defense-aerospace", evidence: "Defense/aerospace, documented quantum program" },
  LDOS: { exposure: "user-adopter", sector: "defense-aerospace", evidence: "Defense/aerospace, documented quantum program" },
  BAH: { exposure: "user-adopter", sector: "defense-aerospace", evidence: "Defense/aerospace, documented quantum program" },
  AMAT: { exposure: "major-supplier", sector: "semiconductors", evidence: "Semiconductor/fab equipment + quantum networking" },
  ASML: { exposure: "major-supplier", sector: "semiconductors", evidence: "Semiconductor/fab equipment + quantum networking" },
  HPE: { exposure: "major-supplier", sector: "semiconductors", evidence: "Semiconductor/fab equipment + quantum networking" },
  CSCO: { exposure: "major-supplier", sector: "semiconductors", evidence: "Semiconductor/fab equipment + quantum networking" },
  NOK: { exposure: "major-supplier", sector: "semiconductors", evidence: "Semiconductor/fab equipment + quantum networking" },
  SKM: { exposure: "major-supplier", sector: "semiconductors", evidence: "Semiconductor/fab equipment + quantum networking" },
};

// From verticals.ts's AI tickers comment groups.
const AI: Record<string, TickerProfile> = {
  NVDA: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI chips/hardware" },
  TSM: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI chips/hardware" },
  AVGO: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI chips/hardware" },
  AMD: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI chips/hardware" },
  ASML: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI chips/hardware" },
  ARM: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI chips/hardware" },
  MRVL: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI chips/hardware" },
  QCOM: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI chips/hardware" },
  MU: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI chips/hardware" },
  SMCI: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI chips/hardware" },
  MSFT: { exposure: "platform-provider", sector: "software-platforms", evidence: "Frontier lab / AI cloud infra incumbent" },
  GOOGL: { exposure: "platform-provider", sector: "software-platforms", evidence: "Frontier lab / AI cloud infra incumbent" },
  AMZN: { exposure: "platform-provider", sector: "software-platforms", evidence: "Frontier lab / AI cloud infra incumbent" },
  META: { exposure: "platform-provider", sector: "software-platforms", evidence: "Frontier lab / AI cloud infra incumbent" },
  CRWV: { exposure: "platform-provider", sector: "software-platforms", evidence: "Frontier lab / AI cloud infra incumbent" },
  NBIS: { exposure: "platform-provider", sector: "software-platforms", evidence: "Frontier lab / AI cloud infra incumbent" },
  ORCL: { exposure: "platform-provider", sector: "software-platforms", evidence: "Frontier lab / AI cloud infra incumbent" },
  PLTR: { exposure: "platform-provider", sector: "software-platforms", evidence: "AI-native application software" },
  AI: { exposure: "platform-provider", sector: "software-platforms", evidence: "AI-native application software" },
  SOUN: { exposure: "platform-provider", sector: "software-platforms", evidence: "AI-native application software" },
  BBAI: { exposure: "platform-provider", sector: "software-platforms", evidence: "AI-native application software" },
  INOD: { exposure: "platform-provider", sector: "software-platforms", evidence: "AI-native application software" },
  PATH: { exposure: "platform-provider", sector: "software-platforms", evidence: "AI-native application software" },
  APP: { exposure: "platform-provider", sector: "software-platforms", evidence: "AI-native application software" },
  CRM: { exposure: "platform-provider", sector: "software-platforms", evidence: "Enterprise software, named AI product" },
  NOW: { exposure: "platform-provider", sector: "software-platforms", evidence: "Enterprise software, named AI product" },
  ADBE: { exposure: "platform-provider", sector: "software-platforms", evidence: "Enterprise software, named AI product" },
  SNOW: { exposure: "platform-provider", sector: "software-platforms", evidence: "Enterprise software, named AI product" },
  SAP: { exposure: "platform-provider", sector: "software-platforms", evidence: "Enterprise software, named AI product" },
  IBM: { exposure: "platform-provider", sector: "software-platforms", evidence: "Enterprise software, named AI product" },
  MDB: { exposure: "platform-provider", sector: "software-platforms", evidence: "Enterprise software, named AI product" },
  WDAY: { exposure: "platform-provider", sector: "software-platforms", evidence: "Enterprise software, named AI product" },
  CRWD: { exposure: "platform-provider", sector: "software-platforms", evidence: "Enterprise software, named AI product" },
  PANW: { exposure: "platform-provider", sector: "software-platforms", evidence: "Enterprise software, named AI product" },
  DDOG: { exposure: "platform-provider", sector: "software-platforms", evidence: "Enterprise software, named AI product" },
  BABA: { exposure: "diversified", sector: "software-platforms", evidence: "Foreign AI lab, real US-tradable ADR" },
  BIDU: { exposure: "diversified", sector: "software-platforms", evidence: "Foreign AI lab, real US-tradable ADR" },
  VRT: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI data-center infrastructure" },
  DELL: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI data-center infrastructure" },
  HPE: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI data-center infrastructure" },
  ANET: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI data-center infrastructure" },
  CRDO: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI data-center infrastructure" },
  ALAB: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI data-center infrastructure" },
  LRCX: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI-chip fabrication equipment" },
  KLAC: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI-chip fabrication equipment" },
  AMAT: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI-chip fabrication equipment" },
  TER: { exposure: "major-supplier", sector: "semiconductors", evidence: "AI-chip fabrication equipment" },
};


// From verticals.ts's biotechnology tickers comment groups, transcribed the
// same way QUANTUM and AI above were — verbatim from the group each ticker
// already sits in, not re-derived. The exposure/sector split matters more
// here than in either other vertical, because it's the one place where
// SEC-EDGAR R&D spend is genuinely vertical-specific for part of the list:
// a gene-editing pure-play's R&D really is biotech R&D, and Eli Lilly's
// mostly isn't. Filtering the R&D breakdown to "Therapeutics" +
// "Engineering-biology platforms" is how a reader gets the honest number.
const BIOTECH: Record<string, TickerProfile> = {
  CRSP: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Gene editing / gene therapy pure-play" },
  NTLA: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Gene editing / gene therapy pure-play" },
  BEAM: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Gene editing / gene therapy pure-play" },
  EDIT: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Gene editing / gene therapy pure-play" },
  CRBU: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Gene editing / gene therapy pure-play" },
  SRPT: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Gene editing / gene therapy pure-play" },
  RARE: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Gene editing / gene therapy pure-play" },
  KRYS: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Gene editing / gene therapy pure-play" },
  ALNY: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "RNA / oligonucleotide therapeutics" },
  IONS: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "RNA / oligonucleotide therapeutics" },
  ARWR: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "RNA / oligonucleotide therapeutics" },
  RNA: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "RNA / oligonucleotide therapeutics" },
  MRNA: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "mRNA vaccines" },
  BNTX: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "mRNA vaccines" },
  NVAX: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "mRNA vaccines" },
  LEGN: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Cell therapy" },
  IOVA: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Cell therapy" },
  ALLO: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Cell therapy" },
  SANA: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Cell therapy" },
  FATE: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Cell therapy" },
  VCEL: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Cell therapy" },
  REGN: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Large-cap biotech" },
  VRTX: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Large-cap biotech" },
  AMGN: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Large-cap biotech" },
  GILD: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Large-cap biotech" },
  BIIB: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Large-cap biotech" },
  ZLAB: { exposure: "pure-play", sector: "biotech-therapeutics", evidence: "Large-cap biotech" },
  RXRX: { exposure: "platform-provider", sector: "biotech-platforms", evidence: "Computational drug discovery / protein design" },
  SDGR: { exposure: "platform-provider", sector: "biotech-platforms", evidence: "Computational drug discovery / protein design" },
  ABSI: { exposure: "platform-provider", sector: "biotech-platforms", evidence: "Computational drug discovery / protein design" },
  TEM: { exposure: "platform-provider", sector: "biotech-platforms", evidence: "Computational drug discovery / protein design" },
  DNA: { exposure: "platform-provider", sector: "biotech-platforms", evidence: "Synthetic biology, DNA synthesis, enzyme engineering" },
  TWST: { exposure: "platform-provider", sector: "biotech-platforms", evidence: "Synthetic biology, DNA synthesis, enzyme engineering" },
  CDXS: { exposure: "platform-provider", sector: "biotech-platforms", evidence: "Synthetic biology, DNA synthesis, enzyme engineering" },
  ILMN: { exposure: "platform-provider", sector: "life-science-tools", evidence: "Sequencing + omics platform" },
  PACB: { exposure: "platform-provider", sector: "life-science-tools", evidence: "Sequencing + omics platform" },
  TXG: { exposure: "platform-provider", sector: "life-science-tools", evidence: "Sequencing + omics platform" },
  QTRX: { exposure: "platform-provider", sector: "life-science-tools", evidence: "Sequencing + omics platform" },
  SEER: { exposure: "platform-provider", sector: "life-science-tools", evidence: "Sequencing + omics platform" },
  NAUT: { exposure: "platform-provider", sector: "life-science-tools", evidence: "Sequencing + omics platform" },
  NTRA: { exposure: "platform-provider", sector: "life-science-tools", evidence: "Molecular diagnostics" },
  GH: { exposure: "platform-provider", sector: "life-science-tools", evidence: "Molecular diagnostics" },
  MYGN: { exposure: "platform-provider", sector: "life-science-tools", evidence: "Molecular diagnostics" },
  QGEN: { exposure: "platform-provider", sector: "life-science-tools", evidence: "Molecular diagnostics" },
  SOPH: { exposure: "platform-provider", sector: "life-science-tools", evidence: "Molecular diagnostics" },
  GRAL: { exposure: "platform-provider", sector: "life-science-tools", evidence: "Molecular diagnostics" },
  TMO: { exposure: "major-supplier", sector: "life-science-tools", evidence: "Life-science tools + bioprocessing" },
  DHR: { exposure: "major-supplier", sector: "life-science-tools", evidence: "Life-science tools + bioprocessing" },
  A: { exposure: "major-supplier", sector: "life-science-tools", evidence: "Life-science tools + bioprocessing" },
  RVTY: { exposure: "major-supplier", sector: "life-science-tools", evidence: "Life-science tools + bioprocessing" },
  BIO: { exposure: "major-supplier", sector: "life-science-tools", evidence: "Life-science tools + bioprocessing" },
  WAT: { exposure: "major-supplier", sector: "life-science-tools", evidence: "Life-science tools + bioprocessing" },
  BRKR: { exposure: "major-supplier", sector: "life-science-tools", evidence: "Life-science tools + bioprocessing" },
  RGEN: { exposure: "major-supplier", sector: "life-science-tools", evidence: "Life-science tools + bioprocessing" },
  CRL: { exposure: "major-supplier", sector: "life-science-tools", evidence: "Life-science tools + bioprocessing" },
  LLY: { exposure: "diversified", sector: "large-pharma", evidence: "Large pharma, documented biologics/vaccine/gene-therapy franchise" },
  PFE: { exposure: "diversified", sector: "large-pharma", evidence: "Large pharma, documented biologics/vaccine/gene-therapy franchise" },
  MRK: { exposure: "diversified", sector: "large-pharma", evidence: "Large pharma, documented biologics/vaccine/gene-therapy franchise" },
  JNJ: { exposure: "diversified", sector: "large-pharma", evidence: "Large pharma, documented biologics/vaccine/gene-therapy franchise" },
  ABBV: { exposure: "diversified", sector: "large-pharma", evidence: "Large pharma, documented biologics/vaccine/gene-therapy franchise" },
  BMY: { exposure: "diversified", sector: "large-pharma", evidence: "Large pharma, documented biologics/vaccine/gene-therapy franchise" },
  AZN: { exposure: "diversified", sector: "large-pharma", evidence: "Large pharma, documented biologics/vaccine/gene-therapy franchise" },
  NVS: { exposure: "diversified", sector: "large-pharma", evidence: "Large pharma, documented biologics/vaccine/gene-therapy franchise" },
  SNY: { exposure: "diversified", sector: "large-pharma", evidence: "Large pharma, documented biologics/vaccine/gene-therapy franchise" },
  GSK: { exposure: "diversified", sector: "large-pharma", evidence: "Large pharma, documented biologics/vaccine/gene-therapy franchise" },
  NVO: { exposure: "diversified", sector: "large-pharma", evidence: "Large pharma, documented biologics/vaccine/gene-therapy franchise" },
  TAK: { exposure: "diversified", sector: "large-pharma", evidence: "Large pharma, documented biologics/vaccine/gene-therapy franchise" },
  ZTS: { exposure: "diversified", sector: "agri-animal-biotech", evidence: "Animal-health and agricultural biotech" },
  CTVA: { exposure: "diversified", sector: "agri-animal-biotech", evidence: "Animal-health and agricultural biotech" },
  BIOX: { exposure: "pure-play", sector: "agri-animal-biotech", evidence: "Animal-health and agricultural biotech" },
};

const BY_VERTICAL: Record<string, Record<string, TickerProfile>> = {
  "quantum-computing": QUANTUM,
  "artificial-intelligence": AI,
  biotechnology: BIOTECH,
};

// Falls back to "diversified"/no sector-specific evidence for any ticker
// added later that hasn't been individually categorized yet — never
// guesses a category, just says so plainly.
export function tickerProfile(verticalId: string, symbol: string): TickerProfile {
  return BY_VERTICAL[verticalId]?.[symbol] ?? { exposure: "diversified", sector: "software-platforms", evidence: "Not yet individually categorized" };
}

// Stable display order for the R&D-breakdown sector chips. Only the values
// a given vertical actually assigns get rendered — the list used to be
// hardcoded to quantum's four, which meant AI showed two permanently-empty
// chips ("Pure-play companies", "Defense and aerospace") and biotechnology
// would have shown three. Derived rather than curated per vertical so a
// ticker added later shows up without a second edit here.
const SECTOR_ORDER: Exclude<RdSector, "all">[] = [
  "pure-play", "biotech-therapeutics", "biotech-platforms", "semiconductors",
  "software-platforms", "life-science-tools", "large-pharma",
  "defense-aerospace", "agri-animal-biotech",
];

export function rdSectorsFor(verticalId: string): RdSector[] {
  const present = new Set(Object.values(BY_VERTICAL[verticalId] ?? {}).map((p) => p.sector));
  return ["all", ...SECTOR_ORDER.filter((s) => present.has(s))];
}
