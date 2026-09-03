import type { StageNote } from "../../src/lib/types.ts";

// The interpretation layer for the space vertical — see data/quantum/notes.ts
// for the convention (one current note per stage, house style: specific
// numbers stated plainly, no colons as clause separators, a light
// interpretive touch rather than a thesis).
//
// Every figure here is one this repo measured or verified. Keep it that way.

export const NOTES: StageNote[] = [
  {
    stage: "innovation",
    date: "2026-09-02",
    author: "E. Johnston",
    headline: "The research corpus is small because most of what looks like space research is astronomy",
    body:
      "A 30-day window on this vertical returns about 550 journal works, a fifth of what biotechnology produces and comparable to quantum. That is not an under-scoped filter, it is the shape of the field. OpenAlex's astronomy and astrophysics subfield alone holds 2.18 million works — four times the entire aerospace subfield — and almost none of it is space technology. Reading a cosmological result as space capability would make China and the United States look like they are competing at something they are not. What is left after the hand-check is launch, propulsion, spacecraft design, satellite communications and the regulation of orbit, and 46 of 50 sampled works carry real institution-country data.",
  },
  {
    stage: "scaling",
    date: "2026-09-02",
    author: "E. Johnston",
    headline: "Landing a booster was the hinge, and the constellation race is what it unlocked",
    body:
      "SpaceX returned a Falcon 9 first stage to Cape Canaveral in December 2015 after a real payload mission, and everything expensive about reaching orbit has been renegotiated since. The visible consequence is not cheaper science, it is volume. China opened Qianfan in August 2024 toward more than 15,000 satellites and Guowang four months later toward 13,000, which are industrial programmes rather than missions. The other half of this stage is the small club that can still do something for the first time — India landing near a lunar pole, Korea reaching orbit on wholly domestic engines, the UAE arriving at Mars on its first try.",
  },
  {
    stage: "adoption",
    date: "2026-09-02",
    author: "E. Johnston",
    headline: "Governments are buying capability from companies and writing the rules around them at the same time",
    body:
      "The Artemis Accords reached 71 signatories in August 2026, with China and Russia outside, which makes the largest bloc in space governance an American drafting exercise rather than a treaty. Europe answered its dependence problem with money rather than doctrine, signing a €10.6 billion concession for IRIS² split 60/40 between public funds and Eutelsat, SES and Hispasat. India took a third route and simply removed the barrier, allowing full foreign ownership of component manufacturing while holding launch vehicles at 49%. Three different theories of how a state gets a space industry, running at once.",
  },
  {
    stage: "investment",
    date: "2026-09-02",
    author: "E. Johnston",
    headline: "NSF is the wrong instrument for this field, and the private number is where to look",
    body:
      "NSF funds space science, not space technology. Querying it for \"satellite\" returns Earth scientists using satellite data for cloud evolution and soil moisture; \"orbital\" matches molecular orbitals in chemistry; \"space technology\" matches 7% of what it returns. The public money that actually buys space capability sits at NASA and the Department of Defense, and this app reaches it through federal contract records rather than grants — Northrop's $575 million Joint Polar Satellite System spacecraft is the shape of it. Against that, the Capital IQ transactions data holds 602 venture-funded space companies with $25.2 billion disclosed, and the names near the top are as often Chinese or European as American.",
  },
];
