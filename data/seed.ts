import type { Entry } from "../src/lib/types.ts";

// Hand-curated entries for the pipeline stages that have no clean live feed.
// This is the honest layer: production/scaling milestones and adoption events
// are reported in press releases and roadmaps, not a queryable API. Add,
// remove, or correct entries here — each is one object. Keep `provenance`
// as "seeded" so the UI labels them correctly. `date` may be YYYY-MM.
//
// To add a new entry: copy a block, change the fields, give it a unique id.

export const SEED: Entry[] = [
  // ── Stage 02: production / scaling ──────────────────────────────
  {
    id: "seed-ibm-roadmap-2025",
    stage: "scaling", actor: "us", provenance: "seeded", source: "milestone",
    title: "IBM outlines Kookaburra / Blue Jay path toward 100k+ physical qubits",
    org: "IBM Quantum", date: "2025-11",
    url: "https://www.ibm.com/quantum/roadmap",
  },
  {
    id: "seed-google-willow-2024",
    stage: "scaling", actor: "us", provenance: "seeded", source: "milestone",
    title: "Google reports below-threshold error correction on Willow chip",
    org: "Google Quantum AI", date: "2024-12",
    url: "https://blog.google/technology/research/google-willow-quantum-chip/",
  },
  {
    id: "seed-quantinuum-h2-2024",
    stage: "scaling", actor: "other", provenance: "seeded", source: "milestone",
    title: "Quantinuum H2 trapped-ion system passes 56 physical qubits at high fidelity",
    org: "Quantinuum", date: "2024-06",
    url: "https://www.quantinuum.com/",
  },
  {
    id: "seed-ustc-zuchongzhi3-2025",
    stage: "scaling", actor: "cn", provenance: "seeded", source: "milestone",
    title: "USTC Zuchongzhi 3.0 superconducting processor demonstration",
    org: "USTC / Hefei", date: "2025-03",
    url: "https://arxiv.org/abs/2412.11924",
  },
  {
    id: "seed-iqm-2025",
    stage: "scaling", actor: "eu", provenance: "seeded", source: "milestone",
    title: "IQM delivers 54-qubit superconducting system to European HPC site",
    org: "IQM (Finland)", date: "2025-02",
    url: "https://www.meetiqm.com/",
  },

  // ── Stage 03: adoption ──────────────────────────────────────────
  {
    id: "seed-aws-braket-2025",
    stage: "adoption", actor: "us", provenance: "seeded", source: "deployment",
    title: "AWS Braket adds new hardware backends for on-demand access",
    org: "Amazon Web Services", date: "2025-09",
    url: "https://aws.amazon.com/braket/",
  },
  {
    id: "seed-darpa-qbi-2025",
    stage: "adoption", actor: "us", provenance: "seeded", source: "deployment",
    title: "DARPA Quantum Benchmarking Initiative advances vendors to validation stage",
    org: "DARPA", date: "2025-07",
    url: "https://www.darpa.mil/research/programs/quantum-benchmarking-initiative",
  },
  {
    id: "seed-eurohpc-2024",
    stage: "adoption", actor: "eu", provenance: "seeded", source: "deployment",
    title: "EuroHPC procures quantum systems co-located with flagship supercomputers",
    org: "EuroHPC JU", date: "2024-10",
    url: "https://eurohpc-ju.europa.eu/",
  },
  {
    id: "seed-origin-2025",
    stage: "adoption", actor: "cn", provenance: "seeded", source: "deployment",
    title: "Origin Quantum reports cloud-platform access hours across domestic users",
    org: "Origin Quantum / Hefei", date: "2025-01",
    url: "https://qc.zdxlz.com/",
  },
];
