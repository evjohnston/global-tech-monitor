import type { StageNote } from "../lib/types.ts";

export function NoteCard({ note }: { note: StageNote }) {
  return (
    <div className="note">
      <div className="note-headline">{note.headline}</div>
      <p className="note-body">{note.body}</p>
      <div className="note-attr">
        {note.author} · {note.date}
      </div>
    </div>
  );
}
