// Maps an institution or company NAME to the country where that
// organization is physically located — headquarters, main campus, or the
// site a news item is actually about. This is a fact about an
// organization's location, not about any individual's nationality or
// citizenship; nothing here reads or infers anything about a person.
//
// Used only where structured location data isn't available (the RSS news
// layer, and the arXiv fallback when OpenAlex has no institution record).
// Deliberately a keyword matcher, not an authority — it will misplace an
// organization when a text mentions multiple countries, or miss one
// entirely when it names neither a place nor a recognized org. The app
// surfaces the evidence string on every entry so a human can correct it.
//
// Order matters: specific place names are checked before generic company
// names, so e.g. a story specifically about PsiQuantum's Australia site
// (which will say "Australia"/"Brisbane"/"Queensland") resolves to AU
// rather than falling through to PsiQuantum's US pattern.
const PATTERNS: { country: string; res: RegExp[] }[] = [
  {
    country: "CN",
    res: [
      /tsinghua/i, /peking\s+univ/i, /\bUSTC\b/i, /hefei/i, /shanghai/i,
      /beijing/i, /zhejiang/i, /chinese\s+academy/i, /\bchina\b/i,
      /shenzhen/i, /wuhan/i, /nanjing/i, /origin\s+quantum/i, /baidu/i,
      /alibaba/i, /tencent/i, /huawei/i, /QuantumCTek/i, /Zuchongzhi/i,
      /Jiuzhang/i, /\bWukong\b/i, /\bAnhui\b/i, /China\s+Telecom/i,
    ],
  },
  { country: "GB", res: [/oxford/i, /cambridge/i, /\bNQCC\b/i, /Oxford\s+Quantum\s+Circuits/i, /united\s+kingdom/i, /\bUK\b/i] },
  { country: "DE", res: [/munich|münchen/i, /max\s+planck/i, /\bgermany\b/i] },
  { country: "FR", res: [/\bparis\b/i, /sorbonne/i, /\bCNRS\b/i, /pasqal/i, /Alice\s*&\s*Bob/i, /\bfrance\b/i] },
  { country: "FI", res: [/\bIQM\b/i, /\bfinland\b/i, /Micronova/i, /\bVTT\b/i] },
  { country: "NL", res: [/delft/i, /netherlands/i] },
  { country: "AT", res: [/vienna/i, /\bAlpine\s+Quantum/i] },
  { country: "DK", res: [/copenhagen/i] },
  { country: "CH", res: [/\bETH\b/i] },
  { country: "ES", res: [/\bspain\b/i, /Qilimanjaro/i] },
  { country: "IT", res: [/\bitaly\b/i] },
  { country: "SE", res: [/\bsweden\b/i] },
  { country: "JP", res: [/\bjapan\b/i, /fujitsu/i, /\bRIKEN\b/i] },
  { country: "KR", res: [/south\s+korea/i, /\bkorea\b/i, /yonsei/i] },
  { country: "CA", res: [/\bcanada\b/i, /xanadu/i, /\bD-Wave\b/i] },
  { country: "AU", res: [/australia/i, /brisbane/i, /queensland/i, /Silicon\s+Quantum\s+Computing/i] },
  { country: "IN", res: [/\bindia\b/i, /QpiAI/i] },
  {
    country: "US",
    res: [
      /\bMIT\b/i, /harvard/i, /stanford/i, /caltech/i, /berkeley/i,
      /univ.*chicago/i, /princeton/i, /\byale\b/i, /\bIBM\b/i, /google/i,
      /microsoft/i, /\bNIST\b/i, /maryland/i, /\bUSA\b/i, /united\s+states/i,
      /california/i, /\bAWS\b/i, /amazon/i, /rigetti/i, /\bIonQ\b/i,
      /atom\s+computing/i, /\bPsiQuantum\b/i, /\bDARPA\b/i, /\bNSF\b/i,
      /\bNERSC\b/i, /lawrence\s+berkeley/i, /air\s+force\s+research/i,
    ],
  },
];

export function inferInstitutionCountry(text: string): { country: string | null; evidence: string } {
  if (!text) return { country: null, evidence: "" };
  for (const { country, res } of PATTERNS) {
    for (const re of res) {
      const m = text.match(re);
      if (m) return { country, evidence: `matched "${m[0]}"` };
    }
  }
  return { country: null, evidence: "no location match" };
}
