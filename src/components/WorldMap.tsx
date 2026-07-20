import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ComposableMap, Geographies, Geography, useGeographies, ZoomableGroup } from "react-simple-maps";
import { geoCentroid } from "d3-geo";
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
      const centroid = geoCentroid(geo);
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
  height,
  dark,
}: {
  geoData: Record<string, unknown>;
  counts: Record<string, number>;
  max: number;
  onSelect?: (country: string) => void;
  active?: string | null;
  height: number;
  dark: boolean;
}) {
  const [zoomState, setZoomState] = useState<{ center: [number, number]; zoom: number }>(DEFAULT_VIEW);
  const [tip, setTip] = useState<{ x: number; y: number; code: string } | null>(null);
  const centroidsRef = useRef<Record<string, [number, number]>>({});

  const handleCentroids = useCallback((byCode: Record<string, [number, number]>) => {
    centroidsRef.current = byCode;
  }, []);

  // Programmatic zoom-to-country: fires whenever the filter changes, not on
  // every render. A user's own drag/scroll (onMoveEnd below) can move the
  // view away from this afterward — that's expected, this only sets the
  // initial framing for a new selection, it doesn't lock the view to it.
  useEffect(() => {
    if (active && centroidsRef.current[active]) {
      setZoomState({ center: centroidsRef.current[active], zoom: 4 });
    } else {
      setZoomState(DEFAULT_VIEW);
    }
  }, [active]);

  return (
    <>
      <ComposableMap projection="geoEqualEarth" width={800} height={height} style={{ width: "100%", height: "100%", display: "block" }}>
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
                const muted = Boolean(active) && !isActive;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={muted ? `rgb(${(dark ? MUTED_RGB_DARK : MUTED_RGB).join(",")})` : heatColor(count, max, dark)}
                    stroke="var(--line)"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none", transition: "fill 0.2s" },
                      hover: { outline: "none", fill: "var(--red)", cursor: code && onSelect ? "pointer" : "default" },
                      pressed: { outline: "none", fill: "var(--red)" },
                    }}
                    onMouseMove={(e: ReactMouseEvent) => code && setTip({ x: e.clientX, y: e.clientY, code })}
                    onMouseLeave={() => setTip(null)}
                    onClick={() => code && onSelect?.(code)}
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
  trend = [],
  dark = false,
}: {
  counts: Record<string, number>;
  onSelect?: (country: string) => void;
  active?: string | null;
  trend?: TrendPoint[];
  dark?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hiRes, setHiRes] = useState<Record<string, unknown> | null>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

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
            height={820}
            dark={dark}
          />
        </div>
        {canScrub && <TimeBar trend={trend} scrubIndex={scrubIndex} onScrub={setScrubIndex} onLive={() => setScrubIndex(null)} />}
      </div>
    );
  }

  return (
    <div>
      <div className="mapbox">
        <MapBody geoData={worldLow as unknown as Record<string, unknown>} counts={shownCounts} max={max} onSelect={onSelect} active={active} height={260} dark={dark} />
        <button className="map-expand" onClick={() => setExpanded(true)} aria-label="Expand map to full page">⤢</button>
      </div>
      {canScrub && <TimeBar trend={trend} scrubIndex={scrubIndex} onScrub={setScrubIndex} onLive={() => setScrubIndex(null)} />}
    </div>
  );
}
