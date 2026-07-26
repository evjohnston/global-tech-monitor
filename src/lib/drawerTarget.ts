// One pinned "what's open in the metadata drawer" value, shared across
// every chart/table/map in the app — a single discriminated union instead
// of a different modal-state shape per component (EntryModal's old
// `selectedEntry: Entry | null`, CountryProfileDrawer's old
// `profileCountry: string | null`, etc). Serializes to the URL's `record`
// param so a pinned selection is shareable and survives a reload.
export type DrawerTarget =
  | { kind: "country"; code: string }
  | { kind: "org"; orgId: string; label?: string } // label = the original display string clicked, used only as a fallback search when orgId resolves to nothing real
  | { kind: "investor"; name: string }
  | { kind: "entry"; id: string }
  | { kind: "collaboration"; a: string; b: string }
  | { kind: "sankeyLink"; investor: string; companyId: string }
  | { kind: "researchFlowLink"; source: string; target: string };

export function serializeDrawerTarget(t: DrawerTarget | null | undefined): string | null {
  if (!t) return null;
  switch (t.kind) {
    case "country":
      return `country:${t.code}`;
    case "org":
      return `org:${encodeURIComponent(t.orgId)}${t.label ? `~${encodeURIComponent(t.label)}` : ""}`;
    case "investor":
      return `investor:${encodeURIComponent(t.name)}`;
    case "entry":
      return `entry:${encodeURIComponent(t.id)}`;
    case "collaboration":
      return `collab:${encodeURIComponent(t.a)}~${encodeURIComponent(t.b)}`;
    case "sankeyLink":
      return `sankey:${encodeURIComponent(t.investor)}~${encodeURIComponent(t.companyId)}`;
    case "researchFlowLink":
      return `researchflow:${encodeURIComponent(t.source)}~${encodeURIComponent(t.target)}`;
  }
}

// Best-effort parse — a malformed or unrecognized value just yields null
// (drawer stays closed) rather than throwing, since this only ever comes
// from a URL a person could hand-edit.
export function parseDrawerTarget(raw: string | null): DrawerTarget | null {
  if (!raw) return null;
  const sep = raw.indexOf(":");
  if (sep < 0) return null;
  const kind = raw.slice(0, sep);
  const rest = raw.slice(sep + 1);
  try {
    switch (kind) {
      case "country":
        return rest ? { kind: "country", code: rest.toUpperCase() } : null;
      case "org": {
        const [id, label] = rest.split("~").map(decodeURIComponent);
        return id ? { kind: "org", orgId: id, label } : null;
      }
      case "investor":
        return rest ? { kind: "investor", name: decodeURIComponent(rest) } : null;
      case "entry":
        return rest ? { kind: "entry", id: decodeURIComponent(rest) } : null;
      case "collab": {
        const [a, b] = rest.split("~").map(decodeURIComponent);
        return a && b ? { kind: "collaboration", a, b } : null;
      }
      case "sankey": {
        const [inv, comp] = rest.split("~").map(decodeURIComponent);
        return inv && comp ? { kind: "sankeyLink", investor: inv, companyId: comp } : null;
      }
      case "researchflow": {
        const [source, target] = rest.split("~").map(decodeURIComponent);
        return source && target ? { kind: "researchFlowLink", source, target } : null;
      }
      default:
        return null;
    }
  } catch {
    return null; // decodeURIComponent throws on a malformed %-escape
  }
}
