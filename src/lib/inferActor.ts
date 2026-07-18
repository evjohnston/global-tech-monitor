import type { Actor } from "./types.ts";

// Affiliation heuristics. This is deliberately a keyword matcher, not an
// authority — arXiv rarely populates structured affiliation, so we read
// names, institutions, and title text. It WILL misclassify (a PRC national
// at MIT reads as US). The app surfaces the evidence string so a human can
// override. Order is intentional: China first, since a US/EU institution
// name appearing in a collaboration shouldn't override a clear PRC lead.
const PATTERNS: { actor: Actor; res: RegExp[] }[] = [
  {
    actor: "cn",
    res: [
      /tsinghua/i, /peking\s+univ/i, /\bUSTC\b/i, /hefei/i, /shanghai/i,
      /beijing/i, /zhejiang/i, /chinese\s+academy/i, /\bchina\b/i,
      /shenzhen/i, /wuhan/i, /nanjing/i, /origin\s+quantum/i, /baidu/i,
      /alibaba/i, /tencent/i, /huawei/i,
    ],
  },
  {
    actor: "us",
    res: [
      /\bMIT\b/i, /harvard/i, /stanford/i, /caltech/i, /berkeley/i,
      /univ.*chicago/i, /princeton/i, /\byale\b/i, /\bIBM\b/i, /google/i,
      /microsoft/i, /\bNIST\b/i, /maryland/i, /\bUSA\b/i, /united\s+states/i,
      /california/i, /\bAWS\b/i, /amazon/i, /rigetti/i, /\bIonQ\b/i,
      /atom\s+computing/i, /\bPsiQuantum\b/i,
    ],
  },
  {
    actor: "eu",
    res: [
      /oxford/i, /cambridge/i, /\bETH\b/i, /delft/i, /munich|münchen/i,
      /\bparis\b/i, /sorbonne/i, /\bCNRS\b/i, /max\s+planck/i, /vienna/i,
      /copenhagen/i, /\bIQM\b/i, /finland/i, /germany/i, /\bfrance\b/i,
      /netherlands/i, /\bEU\b/i, /\bspain\b/i, /\bitaly\b/i, /sweden/i,
      /pasqal/i, /\bAlpine\s+Quantum/i,
    ],
  },
];

export function inferActor(text: string): { actor: Actor; evidence: string } {
  if (!text) return { actor: "other", evidence: "" };
  for (const { actor, res } of PATTERNS) {
    for (const re of res) {
      const m = text.match(re);
      if (m) return { actor, evidence: `matched "${m[0]}"` };
    }
  }
  return { actor: "other", evidence: "no affiliation match" };
}
