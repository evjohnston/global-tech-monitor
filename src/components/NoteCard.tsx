import type { StageNote } from "../lib/types.ts";

export function NoteCard({ note }: { note: StageNote }) {
  return (
    <div className="note">
      <div className="note-h">{note.headline}</div>
      <p className="note-b">{note.body}</p>
      <div className="note-a">{note.author} · {note.date}</div>
    </div>
  );
}
