import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import worldLow from "world-atlas/countries-110m.json";
import { alpha2FromNumeric, countryName } from "../lib/countries.ts";
import { Tooltip } from "./Tooltip.tsx";

// Hoover Red, as RGB — the choropleth scale runs from the neutral panel
// tone to this, so "more activity here" reads as "more of the one brand
// accent," not a new color introduced just for the map.
const RED_RGB: [number, number, number] = [152, 0, 46];
const BASE_RGB: [number, number, number] = [238, 241, 244]; // var(--panel-2)

function heatColor(count: number, max: number): string {
  if (count <= 0) return "#f4f5f6"; // var(--panel) — no data, not zero-as-alarming
  // sqrt compresses the scale so a handful of dominant countries (US, China)
  // don't wash every other real country down to indistinguishable-from-zero.
  const t = Math.sqrt(count / max);
  const rgb = BASE_RGB.map((c0, i) => Math.round(c0 + (RED_RGB[i] - c0) * t));
  return `rgb(${rgb.join(",")})`;
}

interface GeoFeature { rsmKey: string; id?: string | number }

function MapBody({
  geoData,
  counts,
  max,
  onSelect,
  active,
  height,
}: {
  geoData: Record<string, unknown>;
  counts: Record<string, number>;
  max: number;
  onSelect?: (country: string) => void;
  active?: string | null;
  height: number;
}) {
  const [zoomState, setZoomState] = useState<{ center: [number, number]; zoom: number }>({ center: [10, 20], zoom: 1 });
  const [tip, setTip] = useState<{ x: number; y: number; code: string } | null>(null);

  return (
    <>
      <ComposableMap projection="geoEqualEarth" width={800} height={height} style={{ width: "100%", height: "100%", display: "block" }}>
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
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={heatColor(count, max)}
                    stroke="var(--line)"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none", opacity: active && !isActive ? 0.45 : 1, transition: "opacity 0.15s" },
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

export function WorldMap({
  counts,
  onSelect,
  active,
}: {
  counts: Record<string, number>;
  onSelect?: (country: string) => void;
  active?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hiRes, setHiRes] = useState<Record<string, unknown> | null>(null);
  const max = Math.max(1, ...Object.values(counts));

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
            counts={counts}
            max={max}
            onSelect={onSelect}
            active={active}
            height={860}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mapbox">
      <MapBody geoData={worldLow as unknown as Record<string, unknown>} counts={counts} max={max} onSelect={onSelect} active={active} height={320} />
      <button className="map-expand" onClick={() => setExpanded(true)} aria-label="Expand map to full page">⤢</button>
    </div>
  );
}
