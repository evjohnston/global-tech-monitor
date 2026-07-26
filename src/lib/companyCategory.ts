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

export type RdSector = "pure-play" | "semiconductors" | "software-platforms" | "defense-aerospace" | "all";
export const RD_SECTOR_LABEL: Record<RdSector, string> = {
  "pure-play": "Pure-play companies",
  semiconductors: "Semiconductors",
  "software-platforms": "Software and platforms",
  "defense-aerospace": "Defense and aerospace",
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

const BY_VERTICAL: Record<string, Record<string, TickerProfile>> = {
  "quantum-computing": QUANTUM,
  "artificial-intelligence": AI,
};

// Falls back to "diversified"/no sector-specific evidence for any ticker
// added later that hasn't been individually categorized yet — never
// guesses a category, just says so plainly.
export function tickerProfile(verticalId: string, symbol: string): TickerProfile {
  return BY_VERTICAL[verticalId]?.[symbol] ?? { exposure: "diversified", sector: "software-platforms", evidence: "Not yet individually categorized" };
}
