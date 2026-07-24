import type { StageNote } from "../../src/lib/types.ts";

// The interpretation layer. See data/quantum/notes.ts for the pattern this
// follows. House style reminder: specific numbers stated plainly, no colons
// as clause separators, a light interpretive touch rather than a thesis.

export const NOTES: StageNote[] = [
  {
    stage: "innovation",
    date: "2026-07-24",
    author: "E. Johnston",
    headline: "This stage reads researcher headcount, not papers",
    body:
      "There is no OpenAlex research topic for 'the STEM talent pipeline' the way quantum computing or AI have one — the closest candidates came back a grab-bag of vocational-education and generic HR-management papers on a live check. Innovation here is OECD's real, official researcher-headcount statistics by country instead, full-time-equivalent researchers reported to the OECD's Main Science and Technology Indicators. China's reported researcher base has grown past 3 million FTE as of the latest release, more than any OECD member. Read this as a stock, not a flow — it moves slowly year to year by nature.",
  },
  {
    stage: "scaling",
    date: "2026-07-24",
    author: "E. Johnston",
    headline: "Every major economy is running its own visa or training program at once",
    body:
      "The UK's Global Talent visa, Canada's Tech Talent Strategy, Germany's Opportunity Card, Japan's J-Skip/J-Find routes, and South Korea's top-tier visa all launched or expanded within the same three-year window, alongside a wave of US executive actions on O-1A and STEM OPT. That is not coincidence — it is simultaneous competition for the same small pool of people. The corporate side runs in parallel: Amazon, IBM, and Microsoft have each made nine- or ten-figure skilling commitments since 2021.",
  },
  {
    stage: "adoption",
    date: "2026-07-24",
    author: "E. Johnston",
    headline: "US policy swung from expansion to restriction inside two years",
    body:
      "The FY2025 and FY2026 H-1B lotteries ran under a reformed, less-gamed registration process, and the FY2026 selection rate roughly doubled versus the prior year — actual expanded access. Then a $100,000 per-petition fee took effect in September 2025 and was upheld in court that December, a sharp real-world restriction on the same program. Both are adoption-stage facts, not scaling-stage intentions; the pipeline is genuinely more volatile at this stage than quantum or AI's adoption data.",
  },
  {
    stage: "investment",
    date: "2026-07-24",
    author: "E. Johnston",
    headline: "NSF's Education & Human Resources grants are a real, narrow instrument",
    body:
      "Filtering NSF awards by CFDA code 47.076 (the EHR directorate) rather than a keyword search is what makes this stage usable at all — a plain 'STEM workforce' text search matched the boilerplate broader-impacts language in the vast majority of NSF's grants generally, not the ones actually funding workforce programs. What's left is real: GRFP, S-STEM, Robert Noyce, and Advanced Technological Education awards, each with a real dollar figure and a real cohort size. It is still US-only, the same structural gap as every other vertical's investment stage here.",
  },
];
