import type { ReactNode } from "react";

export function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="tip" style={{ left: x, top: y }}>
      {children}
    </div>
  );
}
