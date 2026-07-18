import type { Entry, Stage, StageNote } from "../lib/types.ts";
import { STAGES } from "../lib/types.ts";
import { Card } from "./Card.tsx";
import { NoteCard } from "./NoteCard.tsx";

const STAGE_COLOR: Record<Stage, string> = {
  innovation: "var(--stage-innovation)",
  scaling: "var(--stage-scaling)",
  adoption: "var(--stage-adoption)",
};

const STAGE_NUM: Record<Stage, string> = {
  innovation: "Stage 01",
  scaling: "Stage 02",
  adoption: "Stage 03",
};

export function StageColumn({ stage, entries, note }: { stage: Stage; entries: Entry[]; note?: StageNote }) {
  const meta = STAGES.find((s) => s.id === stage)!;
  return (
    <section className="stage" style={{ ["--stage-color" as string]: STAGE_COLOR[stage] }}>
      <header className="stage-head">
        <div className="stage-num">
          <span className="bar" />
          {STAGE_NUM[stage]} · {meta.label}
        </div>
        <h2 className="stage-name">{meta.label}</h2>
        <div className="stage-count">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </div>
        <p className="stage-blurb">{meta.blurb}</p>
      </header>
      {note && <NoteCard note={note} />}
      <div className="stage-body">
        {entries.length === 0 ? (
          <div className="state-msg">no entries for this filter</div>
        ) : (
          entries.map((e) => <Card key={e.id} entry={e} />)
        )}
      </div>
    </section>
  );
}
