import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { ComposableMap, Geographies, Geography, useGeographies, ZoomableGroup } from "react-simple-maps";
import { geoArea, geoCentroid } from "d3-geo";
import worldLow from "world-atlas/countries-110m.json";
import type { TrendPoint } from "../lib/types.ts";
import { alpha2FromNumeric, countryName } from "../lib/countries.ts";
import { Tooltip } from "./Tooltip.tsx";

// Default view when no country is selected — a wide-angle look at the whole
// world, not zoomed into any one place.
const DEFAULT_VIEW: { center: [number, number]; zoom: number } = { center: [10, 20], zoom: 1 };
// Flat, uniform tone every non-selected country gets dimmed to once a
// country is active — deliberately NOT the real heat color at lower
// opacity (that was the old behavior, and it read as "different countries
// muted differently" since a high-volume country's dimmed red still looked
// darker than a low-volume country's dimmed near-white). One tone means
// every unselected country reads as "not the selection," full stop — real
// volume is still visible on hover via the tooltip.
const MUTED_RGB: [number, number, number] = [222, 224, 227];
const MUTED_RGB_DARK: [number, number, number] = [42, 45, 51];

// Hoover Red, as RGB — the choropleth scale runs from the neutral panel
// tone to this, so "more activity here" reads as "more of the one brand
// accent," not a new color introduced just for the map. Two variants
// because both the red accent and the panel tone flip in dark mode (see
// :root[data-theme="dark"] in index.css) — react-simple-maps needs a real
// computed color per geography, not a CSS var, so this can't just read the
// token at paint time the way the rest of the app does.
const RED_RGB: [number, number, number] = [152, 0, 46];
const RED_RGB_DARK: [number, number, number] = [200, 57, 92];
const BASE_RGB: [number, number, number] = [238, 241, 244]; // var(--panel-2)
const BASE_RGB_DARK: [number, number, number] = [32, 36, 43]; // var(--panel-2), dark

function heatColor(count: number, max: number, dark: boolean): string {
  const base = dark ? BASE_RGB_DARK : BASE_RGB;
  if (count <= 0) return dark ? "#1a1d22" : "#f4f5f6"; // var(--panel) — no data, not zero-as-alarming
  // sqrt compresses the scale so a handful of dominant countries (US, China)
  // don't wash every other real country down to indistinguishable-from-zero.
  const red = dark ? RED_RGB_DARK : RED_RGB;
  const t = Math.sqrt(count / max);
  const rgb = base.map((c0, i) => Math.round(c0 + (red[i] - c0) * t));
  return `rgb(${rgb.join(",")})`;
}

interface GeoFeature { rsmKey: string; id?: string | number }

// The whole-feature spherical centroid (geoCentroid on the full MultiPolygon)
// gets pulled off the real landmass by small, far-away exclaves — confirmed
// by hand (2026-07-20): France's whole-feature centroid lands in the Bay of
// Biscay, well west of the mainland, because Natural Earth's FR feature
// bundles overseas territories into the same MultiPolygon. Countries with a
// single Polygon (no exclaves) aren't affected and skip the extra work.
// Centroid of just the largest ring by area reliably lands on the actual
// country instead (confirmed for FR, US, NZ, JP, GB, IT — all moved onto
// their mainland).
function mainlandCentroid(geo: GeoFeature & { geometry?: { type: string; coordinates: unknown } }): [number, number] {
  const geometry = geo.geometry;
  if (!geometry || geometry.type !== "MultiPolygon") return geoCentroid(geo as never);
  let best: { type: "Polygon"; coordinates: unknown } | null = null;
  let bestArea = -1;
  for (const poly of geometry.coordinates as unknown[]) {
    const candidate = { type: "Polygon" as const, coordinates: poly };
    const area = Math.abs(geoArea(candidate as never));
    if (area > bestArea) { bestArea = area; best = candidate; }
  }
  return best ? geoCentroid({ type: "Feature", geometry: best, properties: {} } as never) : geoCentroid(geo as never);
}

// Renders nothing — mounted alongside <Geographies> purely to read the same
// topojson-derived GeoJSON features via the hook react-simple-maps' own
// <Geographies> uses internally, so a real per-country centroid (from the
// actual rendered geometry, not a separately-maintained lookup table) is
// available for the programmatic zoom below. Runs once per geoData load
// (mount, or hi-res swap on expand) — negligible extra cost next to the
// parse <Geographies> already does.
function CentroidCapture({ geoData, onReady }: { geoData: Record<string, unknown>; onReady: (byCode: Record<string, [number, number]>) => void }) {
  const { geographies } = useGeographies({ geography: geoData });
  useEffect(() => {
    if (geographies.length === 0) return;
    const byCode: Record<string, [number, number]> = {};
    for (const geo of geographies) {
      const code = alpha2FromNumeric(String(geo.id ?? ""));
      if (!code) continue;
      const centroid = mainlandCentroid(geo);
      if (Number.isFinite(centroid[0]) && Number.isFinite(centroid[1])) byCode[code] = centroid;
    }
    onReady(byCode);
  }, [geographies, onReady]);
  return null;
}

function MapBody({
  geoData,
  counts,
  max,
  onSelect,
  active,
  emphasize,
  height,
  dark,
  autoZoom = false,
}: {
  geoData: Record<string, unknown>;
  counts: Record<string, number>;
  max: number;
  onSelect?: (country: string) => void;
  active?: string | null;
  emphasize?: string[];
  height: number;
  dark: boolean;
  autoZoom?: boolean;
}) {
  const [zoomState, setZoomState] = useState<{ center: [number, number]; zoom: number }>(DEFAULT_VIEW);
  const [tip, setTip] = useState<{ x: number; y: number; code: string } | null>(null);
  const centroidsRef = useRef<Record<string, [number, number]>>({});

  const handleCentroids = useCallback((byCode: Record<string, [number, number]>) => {
    centroidsRef.current = byCode;
  }, []);

  // Programmatic zoom-to-country — only in the expanded map. The compact
  // strip is only ~260px tall; there isn't enough vertical room for a 4x
  // zoom to read as intentional rather than a cropped, oddly-placed cutout,
  // and the compact view's whole purpose (see CLAUDE.md) is a whole-world
  // at-a-glance overview anyway. Fires whenever the filter changes, not on
  // every render. A user's own drag/scroll (onMoveEnd below) can move the
  // view away from this afterward — that's expected, this only sets the
  // initial framing for a new selection, it doesn't lock the view to it.
  useEffect(() => {
    if (!autoZoom) return;
    if (active && centroidsRef.current[active]) {
      setZoomState({ center: centroidsRef.current[active], zoom: 4 });
    } else {
      setZoomState(DEFAULT_VIEW);
    }
  }, [active, autoZoom]);

  return (
    <>
      <ComposableMap
        projection="geoEqualEarth"
        width={800}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
        role="img"
        aria-label="World map of tracked activity by country — each country is individually labeled with its real count, keyboard-navigable"
      >
        <CentroidCapture geoData={geoData} onReady={handleCentroids} />
        <ZoomableGroup
          center={zoomState.center}
          zoom={zoomState.zoom}
          minZoom={1}
          maxZoom={8}
          onMoveEnd={(pos) => setZoomState({ center: pos.coordinates, zoom: pos.zoom })}
        >
          <Geographies geography={geoData}>
            {({ geographies }: { geographies: GeoFeature[] }) =>
              geographies.map((geo) => {
                const code = alpha2FromNumeric(String(geo.id ?? ""));
                const count = code ? counts[code] ?? 0 : 0;
                const isActive = Boolean(active) && code === active;
                // A hard country filter (active) takes priority over the
                // multi-country comparison highlight (emphasize) — they're
                // both "which countries matter right now" signals, but only
                // one should drive the map's muting at a time.
                const hasEmphasis = !active && !!emphasize?.length;
                const isEmphasized = hasEmphasis && !!code && emphasize!.includes(code);
                const muted = (Boolean(active) && !isActive) || (hasEmphasis && !isEmphasized);
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={muted ? `rgb(${(dark ? MUTED_RGB_DARK : MUTED_RGB).join(",")})` : heatColor(count, max, dark)}
                    stroke="var(--line)"
                    strokeWidth={0.5}
                    className="map-geography"
                    tabIndex={code && onSelect ? 0 : -1}
                    role={code && onSelect ? "button" : undefined}
                    aria-label={code ? `${countryName(code)}, ${count} ${count === 1 ? "entry" : "entries"}` : undefined}
                    style={{
                      default: { outline: "none", transition: "fill 0.2s" },
                      hover: { outline: "none", fill: "var(--red)", cursor: code && onSelect ? "pointer" : "default" },
                      pressed: { outline: "none", fill: "var(--red)" },
                    }}
                    onMouseMove={(e: ReactMouseEvent) => code && setTip({ x: e.clientX, y: e.clientY, code })}
                    onMouseLeave={() => setTip(null)}
                    onClick={() => code && onSelect?.(code)}
                    onKeyDown={(e: ReactKeyboardEvent) => { if (code && onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(code); } }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      {tip && (
        <Tooltip x={tip.x} y={tip.y}>
          {countryName(tip.code)} · {counts[tip.code] ?? 0} {(counts[tip.code] ?? 0) === 1 ? "entry" : "entries"}
          {onSelect ? " · click to filter" : ""}
        </Tooltip>
      )}
    </>
  );
}

// Scrubs through real trend[] history — each point is a genuine rolling
// 30-day snapshot (see scripts/backfill-trend.ts), not a fabricated
// in-between frame. "Live" jumps back to the caller's current counts,
// which can be fresher than the last recorded trend point.
function TimeBar({
  trend,
  scrubIndex,
  onScrub,
  onLive,
}: {
  trend: TrendPoint[];
  scrubIndex: number | null;
  onScrub: (i: number) => void;
  onLive: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = (scrubIndex ?? trend.length - 1) + 1;
      onScrub(next >= trend.length ? 0 : next);
    }, 450);
    return () => clearInterval(id);
  }, [playing, scrubIndex, trend.length, onScrub]);

  const sliderValue = scrubIndex ?? trend.length - 1;
  const date = trend[sliderValue]?.date ?? "";

  return (
    <div className="map-timebar">
      <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play through time"}>
        {playing ? "⏸" : "▶"}
      </button>
      <input
        type="range"
        min={0}
        max={trend.length - 1}
        value={sliderValue}
        onChange={(e) => { setPlaying(false); onScrub(Number(e.target.value)); }}
      />
      <span className="date num">{scrubIndex === null ? "Live" : date}</span>
      <button onClick={() => { setPlaying(false); onLive(); }} disabled={scrubIndex === null}>Live</button>
    </div>
  );
}

export function WorldMap({
  counts,
  onSelect,
  active,
  emphasize,
  trend = [],
  dark = false,
}: {
  counts: Record<string, number>;
  onSelect?: (country: string) => void;
  active?: string | null;
  emphasize?: string[];
  trend?: TrendPoint[];
  dark?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hiRes, setHiRes] = useState<Record<string, unknown> | null>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  // The map is now a standalone full-width panel (see .map-panel in
  // index.css) with no sibling to height-match — .mapbox gets a real,
  // definite CSS height per breakpoint (500/440/340px) instead. A fixed
  // viewBox height here is deliberate, NOT measured from the DOM: this used
  // to read the box's live rendered height via ResizeObserver and feed it
  // straight back in as this same prop, but with .mapbox's height itself
  // driven by percentage/auto CSS (no external stretch anymore), the SVG's
  // own intrinsic-aspect-ratio sizing turned that into a real feedback loop
  // — each measured height became a taller next height, ballooning the
  // panel to thousands of pixels in a few frames (confirmed by hand: a
  // ~1.5x multiply per cycle, compounding). ComposableMap's default
  // preserveAspectRatio ("xMidYMid meet") just letterboxes if this doesn't
  // exactly match .mapbox's real aspect ratio — a minor, static cosmetic
  // tradeoff, not a growing one.
  const COMPACT_VIEWBOX_HEIGHT = 500;

  const shownCounts = scrubIndex !== null && trend[scrubIndex] ? trend[scrubIndex].counts : counts;
  const max = Math.max(1, ...Object.values(shownCounts));
  const canScrub = trend.length >= 3;

  useEffect(() => {
    if (!expanded) return;
    // Higher-resolution topojson (241 features vs 177) only loaded when the
    // user actually expands — no reason to ship 750KB extra to everyone who
    // never opens the full map.
    let cancelled = false;
    import("world-atlas/countries-50m.json").then((mod) => {
      if (!cancelled) setHiRes(mod.default as unknown as Record<string, unknown>);
    });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => { cancelled = true; window.removeEventListener("keydown", onKey); };
  }, [expanded]);

  if (expanded) {
    return (
      <div className="map-fullscreen">
        <div className="map-fullscreen-head">
          <span className="lbl">Where the work happens — full map</span>
          <button className="ghost-btn" onClick={() => setExpanded(false)}>✕ close (esc)</button>
        </div>
        <div className="map-fullscreen-body">
          <MapBody
            geoData={(hiRes ?? (worldLow as unknown as Record<string, unknown>))}
            counts={shownCounts}
            max={max}
            onSelect={onSelect}
            active={active}
            emphasize={emphasize}
            height={820}
            dark={dark}
            autoZoom
          />
        </div>
        {canScrub && <TimeBar trend={trend} scrubIndex={scrubIndex} onScrub={setScrubIndex} onLive={() => setScrubIndex(null)} />}
      </div>
    );
  }

  return (
    <div className="map-wrap">
      <div className="mapbox">
        <MapBody geoData={worldLow as unknown as Record<string, unknown>} counts={shownCounts} max={max} onSelect={onSelect} active={active} emphasize={emphasize} height={COMPACT_VIEWBOX_HEIGHT} dark={dark} />
        <button className="map-expand" onClick={() => setExpanded(true)} aria-label="Expand map to full page">⤢</button>
      </div>
      {canScrub && <TimeBar trend={trend} scrubIndex={scrubIndex} onScrub={setScrubIndex} onLive={() => setScrubIndex(null)} />}
    </div>
  );
}
