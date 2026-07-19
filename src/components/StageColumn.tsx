import type { Entry, Stage, StageNote } from "../lib/types.ts";
import { STAGES } from "../lib/types.ts";
import { Card } from "./Card.tsx";
import { NoteCard } from "./NoteCard.tsx";

const STAGE_VAR: Record<Stage, string> = {
  innovation: "var(--cn)", scaling: "var(--eu)", adoption: "var(--us)", investment: "var(--slate)",
};
const STAGE_NUM: Record<Stage, string> = {
  innovation: "01", scaling: "02", adoption: "03", investment: "04",
};

export function StageColumn({
  stage,
  entries,
  note,
  highlightOrg,
  id,
}: {
  stage: Stage;
  entries: Entry[];
  note?: StageNote;
  highlightOrg?: string | null;
  id?: string;
}) {
  const meta = STAGES.find((s) => s.id === stage)!;
  return (
    <section id={id} className="stage" style={{ ["--stage" as string]: STAGE_VAR[stage] }}>
      <header className="stage-head">
        <div className="stage-tag"><span className="bar" />{STAGE_NUM[stage]} · {meta.label}</div>
        <h3 className="stage-name">{meta.label}</h3>
        <div className="stage-count">{entries.length} {entries.length === 1 ? "entry" : "entries"}</div>
        <p className="stage-blurb">{meta.blurb}</p>
      </header>
      {note && <NoteCard note={note} />}
      <div className="stage-body">
        {entries.length === 0
          ? <div className="trend-empty" style={{ padding: "22px 14px", textAlign: "center" }}>no entries for this filter</div>
          : entries.map((e) => (
              <Card key={e.id} entry={e} dim={Boolean(highlightOrg) && e.org !== highlightOrg} />
            ))}
      </div>
    </section>
  );
}
