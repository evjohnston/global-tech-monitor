import type { StageNote } from "../../src/lib/types.ts";

// The interpretation layer for the biotechnology vertical — see
// data/quantum/notes.ts for the convention (one current note per stage,
// house style: specific numbers stated plainly, no colons as clause
// separators, a light interpretive touch rather than a thesis).
//
// Every figure in these notes is one this repo actually measured or
// verified, not an industry rule of thumb. If you edit them, keep that
// property — an unsourced round number in the interpretation layer reads
// exactly as authoritative as a checked one.

export const NOTES: StageNote[] = [
  {
    stage: "innovation",
    date: "2026-09-02",
    author: "E. Johnston",
    headline: "Biotech's research corpus is enormous, and almost none of the volume is the frontier",
    body:
      "A 30-day window on this vertical's OpenAlex filter returns about 9,800 journal works with structured institution data on all 50 of a sampled 50 — the cleanest attribution of any vertical in this monitor, and roughly the same monthly volume as artificial intelligence. The filter had to be built topic by topic to get there. OpenAlex files a Listeria food-safety topic and a marine-sponge natural-products topic under its own \"Biotechnology\" subfield, and its broadest biotech-named topic turns out to be Nature news copy about heatwaves and prize announcements. What survives the hand-check is the platform layer — gene editing, protein design, single-cell and spatial omics, biomanufacturing — a much smaller thing than the field's total publication count suggests.",
  },
  {
    stage: "scaling",
    date: "2026-09-02",
    author: "E. Johnston",
    headline: "Biomanufacturing capacity is counted in litres, and an implausible share of it sits in one Korean city",
    body:
      "Samsung Biologics now runs 785,000 litres across five Songdo plants, having put its first campus alone at over a quarter of global contract manufacturing capacity, and Celltrion holds another 250,000 litres a few kilometres away. Lonza paid $1.2 billion for a single 330,000-litre site in California rather than build one. The scarce asset in biotechnology is not a discovery, it is a validated bioreactor with a regulator's licence on it, which is why the most revealing entries in this stage are real-estate and construction news with a molecule attached. Read the same stage from the other end and it is a story about doses rather than litres, where Serum Institute of India and Indonesia's Bio Farma each out-produce anything in Europe or North America.",
  },
  {
    stage: "adoption",
    date: "2026-09-02",
    author: "E. Johnston",
    headline: "Regulatory approval is the adoption gate, and it is where national positions diverge most sharply",
    body:
      "The MHRA cleared the world's first CRISPR medicine in November 2023, three weeks ahead of the FDA, and India's CDSCO had already approved an indigenous CAR-T priced near $50,000 against roughly $400,000 in the United States. Singapore cleared cultivated meat in 2020 and Israel cleared cultivated beef in 2024, while a Philippine court withdrew Golden Rice in 2024 from the first country that had ever approved it. Nothing in this stage tracks technical readiness. It tracks how a given regulator handles novelty, and on that measure the leaders and the laggards are not the countries the research volume would predict.",
  },
  {
    stage: "investment",
    date: "2026-09-02",
    author: "E. Johnston",
    headline: "The public number here is a keyword artefact, and the private number dwarfs it either way",
    body:
      "NSF's award API answers a \"biotechnology\" keyword with ecology and fellowship grants that mention biotech once in their broader-impacts paragraph — 222 of 300 sampled awards passed a topical regex, and only 59 named an actual biotech technique. Querying \"biomanufacturing\" instead returns 300 of 300 real bioengineering awards worth $403 million, which is why this vertical uses it, at the cost of covering the bioengineering slice rather than the whole portfolio. Set against that, the Capital IQ transactions data holds 1,848 venture-funded biotech companies with $83 billion in disclosed rounds. Public funding is not where the money in this field is, and never has been.",
  },
];
