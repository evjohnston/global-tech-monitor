import { useEffect, useState } from "react";

// Single source of truth for prefers-reduced-motion — gates the Sankey's
// particle animation and any other non-essential motion. Reads the real
// media query, not a guess; updates live if the OS setting changes mid-
// session rather than only at mount.
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
