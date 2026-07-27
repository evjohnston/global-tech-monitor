import { useState } from "react";

// Shared isolate/search/hover state for this app's Sankey diagrams
// (MoneyFlowSankey.tsx, ResearchFlowSankey.tsx) — both independently grew
// the identical shape (click a node to isolate it, hover previews on top of
// a pin, search highlights by label, Reset clears everything) since they're
// answering the same real interaction need on two different real flows.
// `isLinkActive`/link-tracing logic stays per-component since the two
// diagrams genuinely differ there (ResearchFlowSankey traces a focused
// country through to its institutions' downstream links; MoneyFlowSankey
// only matches a link's own two endpoints) — this hook only covers the
// state and derivations that were byte-for-byte identical in both.
export function useSankeyIsolateSearch() {
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverLink, setHoverLink] = useState<number | null>(null);
  // Clicking a node ISOLATES it (persists after the mouse leaves, unlike
  // hover) — hover still previews on top of a pin, but clicking empty
  // space or Reset clears the pin.
  const [pinnedNode, setPinnedNode] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tip, setTip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);

  const focusNode = hoverNode ?? pinnedNode; // hover previews on top of a pin, pin persists after the mouse leaves
  const searchQuery = search.trim().toLowerCase();
  const matchesSearch = (label: string) => searchQuery.length > 0 && label.toLowerCase().includes(searchQuery);
  const anySearch = searchQuery.length > 0;
  const anyHover = focusNode != null || hoverLink != null || anySearch;

  function reset() {
    setHoverNode(null);
    setHoverLink(null);
    setPinnedNode(null);
    setSearch("");
  }
  function togglePin(id: string) {
    setPinnedNode((p) => (p === id ? null : id));
  }

  return {
    hoverNode, setHoverNode, hoverLink, setHoverLink, pinnedNode, setPinnedNode, search, setSearch, tip, setTip,
    focusNode, matchesSearch, anySearch, anyHover, reset, togglePin,
  };
}
