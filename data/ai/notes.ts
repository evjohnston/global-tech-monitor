import type { StageNote } from "../../src/lib/types.ts";

// The interpretation layer for the artificial-intelligence vertical — see
// data/quantum/notes.ts for the convention (one current note per stage,
// house style: specific numbers stated plainly, no colons as clause
// separators, a light interpretive touch rather than a thesis).

export const NOTES: StageNote[] = [
  {
    stage: "innovation",
    date: "2026-07-19",
    author: "E. Johnston",
    headline: "Open-weight models from China now match closed US frontier models on published benchmarks",
    body:
      "DeepSeek V3 and R1, Kimi K2, and GLM-4.5 all publish weights and training details that Western labs mostly withhold. That openness makes Chinese progress easier to verify than US progress, not harder — the actual gap between the two is smaller than public discourse suggests, and getting harder to call from outside either country's frontier lab.",
  },
  {
    stage: "scaling",
    date: "2026-07-19",
    author: "E. Johnston",
    headline: "The bottleneck moved from parameters to power",
    body:
      "Every major 2025-2026 scaling announcement is now measured in gigawatts and GPU counts, not parameter counts alone — Stargate, Colossus, and the sovereign AI campuses in the Gulf are fundamentally energy and construction projects with a model attached. Whoever can permit and power a gigawatt-scale site fastest sets the pace, not whoever has the best training recipe.",
  },
  {
    stage: "adoption",
    date: "2026-07-19",
    author: "E. Johnston",
    headline: "Government adoption is moving faster than the public debate about it",
    body:
      "The US GSA's $1-per-agency deals with OpenAI, Anthropic, Meta, and xAI put frontier models inside the federal government within months of each company's release cycle, while dozens of other governments are still at the strategy-document stage. The real adoption frontier isn't the US versus China anymore — it's the gap between governments that signed a real deployment contract and the much longer list that only published a strategy.",
  },
  {
    stage: "investment",
    date: "2026-07-19",
    author: "E. Johnston",
    headline: "NSF funding is a footnote next to what the labs and hyperscalers spend themselves",
    body:
      "Microsoft alone confirmed roughly $80 billion in AI data-center capex for a single fiscal year — orders of magnitude past what NSF disburses in AI-tagged grants. Public research funding here isn't the investment story the way it is for quantum computing; the real capital is private, concentrated in a handful of US hyperscalers and labs, and mostly undisclosed at the contract level.",
  },
];
