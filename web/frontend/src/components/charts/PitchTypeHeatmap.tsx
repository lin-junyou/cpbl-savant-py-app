"use client";

/**
 * Savant-style per-pitch-type location heatmap.
 *
 * Layout:
 *   ┌─────────────────┐
 *   │ Pitch type      │  pitch color name + N pitches (X%) + ⚾ icon
 *   ├─────────────────┤
 *   │   ┌─ KDE ─┐     │  smooth 2D KDE (pale-blue periphery → deep red core)
 *   │   │ [SZ]  │     │  dashed strike zone overlay
 *   │   └───────┘     │
 *   │    ◇ home       │
 *   └─────────────────┘
 *
 * Renders to a <canvas> for smooth gradients; overlays the strike zone box
 * and home plate as SVG so they stay crisp.
 */
import { useEffect, useMemo, useRef } from "react";
import { PITCH_COLORS } from "./StrikeZone";
import type { PitchLocation } from "@/lib/api";
import { SpinningBall3D } from "./SpinningBall3D";

// ─── Animated baseball (Savant-style, real Three.js sphere) ──────────────
//
// Savant renders its small per-pitch-type baseball inside a 50×50 <canvas>
// using WebGL with the official ball texture; the sphere rotates around the
// inferred spin axis at the pitch's measured RPM, slowed down for viewing.
// We reuse `SpinningBall3D` (already used inside the Spin Direction widget)
// to get the same MLB Savant ball texture and correct axis rotation.
//
// Axis convention reminder:
//   `tilt` is the spin direction in clock-face degrees (0 = 12 o'clock,
//   increasing clockwise — same as Savant's "Tilt" column). The actual
//   rotation axis is *perpendicular* to that direction in 3D; the
//   SpinningBall3D component handles that geometry internally.

interface BaseballIconProps {
  /** Mean spin direction (degrees, 0 = 12 o'clock, +CW). */
  tilt: number | null | undefined;
  /** Average spin rate in RPM. */
  rpm: number | null | undefined;
  /** Render size in px (matches Savant's 50×50). */
  size?: number;
}

export function BaseballIcon({ tilt, rpm, size = 50 }: BaseballIconProps) {
  return (
    <SpinningBall3D axisDeg={tilt ?? 0} rpm={rpm ?? 0} size={size} />
  );
}

const ZH_PITCH_NAME: Record<string, string> = {
  "Four-Seam":   "Four-Seamer",
  "Two-Seam":    "Two-Seamer",
  "Sinker":      "Sinker",
  "Cutter":      "Cutter",
  "Slider":      "Slider",
  "Sweeper":     "Sweeper",
  "Curveball":   "Curveball",
  "Changeup":    "Changeup",
  "Splitter":    "Split-Finger",
  "Knuckleball": "Knuckleball",
};

interface PanelProps {
  pitchType: string;
  pitches: PitchLocation[];
  totalForAll: number;
  /** Mean spin tilt for this pitch type, degrees (0 = 12 o'clock, +CW) */
  spinTilt?: number | null;
  /** Average spin rate for this pitch type, RPM */
  spinRpm?: number | null;
  width?: number;
  height?: number;
}

// Catcher-view domain
const X_MIN = -1.0, X_MAX = 1.0;
const Y_MIN = -0.2, Y_MAX = 2.0;
// MLB rulebook strike-zone (in metres; CPBL average since hitter height varies)
const ZONE_X = 0.215, ZONE_TOP = 1.07, ZONE_BOT = 0.46;

function PitchHeatmapPanel({
  pitchType, pitches, totalForAll, spinTilt, spinRpm,
  width = 240, height = 280,
}: PanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const color = PITCH_COLORS[pitchType] ?? "#dc2626";
  const count = pitches.length;
  const pct = totalForAll > 0 ? (count / totalForAll) * 100 : 0;

  // Mapping helpers (catcher view: flip X so + is to the right)
  const xMap = useMemo(
    () => (x: number) => ((X_MAX - x) / (X_MAX - X_MIN)) * width,
    [width],
  );
  const yMap = useMemo(
    () => (y: number) => height - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * height,
    [height],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High-DPI scaling so the KDE looks crisp on retina
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (count === 0) return;

    // 2D KDE on a grid then blit as imageData.
    // bandwidth in domain units (~ ball width)
    const bw = 0.18;
    const gridX = 60;
    const gridY = 80;
    const cellW = width / gridX;
    const cellH = height / gridY;
    const grid = new Float32Array(gridX * gridY);

    const data = pitches
      .map((p) => [p.plate_loc_side, p.plate_loc_height] as [number, number])
      .filter(([sx, sy]) => sx != null && sy != null);

    // For each pixel cell, sum gaussian kernels from each pitch.
    // O(grid * pitches). 60*80=4800 cells × ~300 pitches ≈ 1.4M ops – fast enough.
    for (let i = 0; i < gridX; i++) {
      const px = X_MIN + ((i + 0.5) / gridX) * (X_MAX - X_MIN);
      for (let j = 0; j < gridY; j++) {
        const py = Y_MIN + ((gridY - 0.5 - j) / gridY) * (Y_MAX - Y_MIN);
        let s = 0;
        for (const [sx, sy] of data) {
          const dx = (px - sx) / bw;
          const dy = (py - sy) / bw;
          s += Math.exp(-(dx * dx + dy * dy) / 2);
        }
        grid[j * gridX + i] = s;
      }
    }

    // Normalise
    let maxVal = 0;
    for (let k = 0; k < grid.length; k++) if (grid[k] > maxVal) maxVal = grid[k];
    if (maxVal <= 0) return;

    // Savant-ish color ramp: very low = white, low = lavender/light blue, mid = orange, high = deep red.
    // We render each cell as a filled rect for speed; with 60×80 cells at 4×3.5 px each, the grid blends to a smooth field.
    const STOPS: Array<[number, [number, number, number]]> = [
      [0.0, [255, 255, 255]],
      [0.08, [225, 232, 255]],   // very pale lavender
      [0.22, [173, 198, 240]],   // light blue
      [0.45, [255, 196, 122]],   // peach
      [0.7, [232, 90, 62]],      // red-orange
      [1.0, [180, 14, 22]],      // deep red
    ];
    const ramp = (t: number) => {
      for (let s = 1; s < STOPS.length; s++) {
        const [tA, cA] = STOPS[s - 1];
        const [tB, cB] = STOPS[s];
        if (t <= tB) {
          const f = (t - tA) / Math.max(1e-6, tB - tA);
          return cA.map((v, i) => Math.round(v + (cB[i] - v) * f)) as [number, number, number];
        }
      }
      return STOPS[STOPS.length - 1][1];
    };

    for (let i = 0; i < gridX; i++) {
      for (let j = 0; j < gridY; j++) {
        const v = grid[j * gridX + i] / maxVal;
        if (v < 0.04) continue; // skip near-zero cells so the white background shows through
        const [r, g, b] = ramp(v);
        // Soft fade-in at low density
        const alpha = Math.min(1, 0.18 + v * 0.95);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(i * cellW, j * cellH, cellW + 0.5, cellH + 0.5);
      }
    }
  }, [pitches, width, height, count]);

  return (
    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <div>
          <div className="text-sm font-bold leading-tight" style={{ color }}>
            {ZH_PITCH_NAME[pitchType] ?? pitchType}
          </div>
          <div className="text-[11px] text-slate-700 tabular-nums">
            {count} Pitches ({pct.toFixed(1)}%)
            {spinRpm != null && spinRpm > 0 && (
              <span className="ml-2 text-slate-600">{Math.round(spinRpm)} rpm</span>
            )}
          </div>
        </div>
        {/* Real 3D textured baseball (same model as Savant uses) — rotates
            around the inferred spin axis at this pitch's RPM (slowed 120×). */}
        <BaseballIcon tilt={spinTilt} rpm={spinRpm} size={50} />
      </div>
      <div className="relative" style={{ width, height }}>
        <canvas ref={canvasRef} className="absolute inset-0" />
        {/* Strike zone overlay + home plate */}
        <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
          {/* Strike zone (dashed) */}
          <rect
            x={xMap(ZONE_X)}
            y={yMap(ZONE_TOP)}
            width={xMap(-ZONE_X) - xMap(ZONE_X)}
            height={yMap(ZONE_BOT) - yMap(ZONE_TOP)}
            fill="none"
            stroke="#1f2937"
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
          {/* 9-zone faint grid */}
          {[1, 2].map((k) => {
            const ratio = k / 3;
            return (
              <g key={k}>
                <line
                  x1={xMap(ZONE_X) + (xMap(-ZONE_X) - xMap(ZONE_X)) * ratio}
                  x2={xMap(ZONE_X) + (xMap(-ZONE_X) - xMap(ZONE_X)) * ratio}
                  y1={yMap(ZONE_TOP)}
                  y2={yMap(ZONE_BOT)}
                  stroke="#94a3b8"
                  strokeWidth={0.5}
                  strokeDasharray="2 2"
                />
                <line
                  y1={yMap(ZONE_TOP) + (yMap(ZONE_BOT) - yMap(ZONE_TOP)) * ratio}
                  y2={yMap(ZONE_TOP) + (yMap(ZONE_BOT) - yMap(ZONE_TOP)) * ratio}
                  x1={xMap(ZONE_X)}
                  x2={xMap(-ZONE_X)}
                  stroke="#94a3b8"
                  strokeWidth={0.5}
                  strokeDasharray="2 2"
                />
              </g>
            );
          })}
          {/* Home plate at bottom (pale grey silhouette) */}
          <path
            d={
              `M ${xMap(ZONE_X * 1.4)} ${yMap(-0.05)} ` +
              `L ${xMap(-ZONE_X * 1.4)} ${yMap(-0.05)} ` +
              `L ${xMap(-ZONE_X * 0.95)} ${yMap(-0.13)} ` +
              `L ${xMap(0)} ${yMap(-0.17)} ` +
              `L ${xMap(ZONE_X * 0.95)} ${yMap(-0.13)} Z`
            }
            fill="#e2e8f0"
            stroke="#94a3b8"
            strokeWidth={0.5}
          />
        </svg>
      </div>
    </div>
  );
}

interface GridProps {
  pitches: PitchLocation[];
  /** If omitted, derives pitch types from `pitches` in usage order. */
  pitchTypes?: string[];
  /**
   * Optional spin information per pitch type — drives the animated baseball
   * icon at the top of each card. Provide `directions[]` (degrees, 0=12
   * o'clock, +CW) so we can compute mean tilt, plus the `avg_spin` RPM.
   */
  spinByType?: Array<{
    pitch_type: string;
    directions: number[];
    avg_spin: number | null;
  }>;
  /** How many panels per row at xl breakpoint */
  panelWidth?: number;
  panelHeight?: number;
}

function meanAngleDeg(degs: number[]): number {
  if (!degs.length) return 0;
  let sx = 0, sy = 0;
  for (const d of degs) {
    const r = (d * Math.PI) / 180;
    sx += Math.cos(r);
    sy += Math.sin(r);
  }
  let m = (Math.atan2(sy, sx) * 180) / Math.PI;
  if (m < 0) m += 360;
  return m;
}

/**
 * Renders one heatmap card per pitch type. Pass the full set of plate
 * locations and we'll group internally so panel order matches usage rank.
 */
export function PitchTypeHeatmapGrid({
  pitches, pitchTypes, spinByType, panelWidth = 240, panelHeight = 280,
}: GridProps) {
  const spinMap = useMemo(() => {
    const m = new Map<string, { tilt: number; rpm: number | null }>();
    spinByType?.forEach((s) => {
      m.set(s.pitch_type, {
        tilt: meanAngleDeg(s.directions ?? []),
        rpm: s.avg_spin,
      });
    });
    return m;
  }, [spinByType]);

  const grouped = useMemo(() => {
    const groups = new Map<string, PitchLocation[]>();
    for (const p of pitches) {
      const key = p.auto_pitch_type ?? "Unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    const order = pitchTypes ?? Array.from(groups.keys());
    return order
      .filter((t) => groups.has(t) && (groups.get(t)?.length ?? 0) > 0)
      .map((t) => ({ pitch_type: t, pitches: groups.get(t)! }))
      .sort((a, b) => b.pitches.length - a.pitches.length);
  }, [pitches, pitchTypes]);

  const total = pitches.length;
  if (!grouped.length) {
    return <div className="text-slate-700 text-sm py-6 text-center">沒有球種資料</div>;
  }

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
      {grouped.map((g) => {
        const spin = spinMap.get(g.pitch_type);
        return (
          <PitchHeatmapPanel
            key={g.pitch_type}
            pitchType={g.pitch_type}
            pitches={g.pitches}
            totalForAll={total}
            spinTilt={spin?.tilt}
            spinRpm={spin?.rpm}
            width={panelWidth}
            height={panelHeight}
          />
        );
      })}
    </div>
  );
}
