import type { StageNote } from "../src/lib/types.ts";

// The interpretation layer. A raw feed doesn't help a reader with ten minutes;
// a dated analyst note does. Write these yourself — one per stage, updated as
// the picture changes. Keep the headline to one line and the body to a few
// sentences. Only the most recent note per stage is shown; older ones are
// kept for the record.
//
// House style reminder: specific numbers stated plainly, no colons as clause
// separators, a light interpretive touch rather than a thesis.

export const NOTES: StageNote[] = [
  {
    stage: "innovation",
    date: "2026-07-18",
    author: "E. Johnston",
    headline: "Error-correction and networking dominate the current preprint flow",
    body:
      "The newest quant-ph papers cluster around fault-tolerant codes and entanglement distribution rather than raw qubit records. That shift, from building bigger chips to making existing ones reliable, is the tell that the field is moving from demonstration toward engineering. Watch whether the US share of these papers holds as Chinese groups publish more on the same problems.",
  },
  {
    stage: "scaling",
    date: "2026-07-18",
    author: "E. Johnston",
    headline: "Below-threshold error correction is the milestone that actually matters",
    body:
      "Google's Willow result and IBM's stated path to 100k physical qubits are the two anchors here. The qubit-count headlines matter less than whether error rates fall as systems grow, which is the thing that decides if any of this scales. This stage has no live feed by design, so treat the five entries as a curated watchlist, not a census.",
  },
  {
    stage: "adoption",
    date: "2026-07-18",
    author: "E. Johnston",
    headline: "Procurement is still government and cloud, not end users",
    body:
      "DARPA's benchmarking program and EuroHPC's co-located systems show that the buyers are states and supercomputing centers, not commercial customers solving real problems. That is the honest state of adoption in 2026. The policy question is whether public procurement sustains the vendors long enough for a commercial market to appear.",
  },
  {
    stage: "investment",
    date: "2026-07-18",
    author: "E. Johnston",
    headline: "US funding is visible, Chinese funding is not",
    body:
      "NSF awards give a clean read on US public spending on quantum, but there is no comparable public feed for China's NSFC or the provincial programs that carry much of the weight. Treat this stage as a floor on Western investment rather than a balanced comparison. The gap is a data-access problem, not evidence that Beijing is spending less.",
  },
];
