"use client";

/**
 * Spin Direction widget — Savant-inspired.
 *
 * Centre clock face shows the inferred tilt arrow per pitch type.
 *   • Outer rim KDE arc per pitch type: where each pitch type's spin
 *     direction concentrates (darker = more pitches at that clock hour).
 *   • Arrows animate, rotating around the inferred spin axis at a slowed
 *     version of the measured RPM so the visual feel matches Savant.
 *
 * CPBL Trackman doesn't expose Measured Tilt (gyroscope) so we cannot
 * compute Active Spin %. The tilt shown here is *inferred* from magnus
 * deflection vs gravity-only flight.
 */
import * as d3 from "d3";
import { useEffect, useMemo, useRef } from "react";
import { PITCH_COLORS } from "./StrikeZone";

export interface SpinSpread {
  pitch_type: string;
  /** All inferred spin direction degrees, 0=12 o'clock, +clockwise. */
  directions: number[];
  count: number;
  avg_spin: number | null;
}

// ─── Circular stats helpers ──────────────────────────────────────────────

function meanAngle(degs: number[]): number {
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

function circularStdDev(degs: number[]): number {
  if (!degs.length) return 0;
  let sx = 0, sy = 0;
  for (const d of degs) {
    const r = (d * Math.PI) / 180;
    sx += Math.cos(r);
    sy += Math.sin(r);
  }
  const R = Math.sqrt(sx * sx + sy * sy) / degs.length;
  // Mardia / Jupp formula: σ = sqrt(-2 ln R), in radians → degrees
  if (R <= 0) return 90;
  return (Math.sqrt(-2 * Math.log(Math.min(1, R))) * 180) / Math.PI;
}

function degToClock(deg: number): string {
  const totalMin = Math.round((deg / 360) * 12 * 60);
  let hh = Math.floor(totalMin / 60);
  if (hh === 0) hh = 12;
  const mm = totalMin % 60;
  return `${hh}:${mm.toString().padStart(2, "0")}`;
}

/**
 * Wrapped circular KDE — for each of `bins` evenly spaced angles around the
 * clock, returns the kernel density. Uses a von-Mises-ish gaussian kernel
 * that wraps across 0/360 so density doesn't artificially drop at 12 o'clock.
 */
function circularKDE(degs: number[], bins = 72, bandwidth = 18): number[] {
  const out = new Array(bins).fill(0);
  if (!degs.length) return out;
  const step = 360 / bins;
  const twoVar = 2 * bandwidth * bandwidth;
  for (let i = 0; i < bins; i++) {
    const angle = i * step;
    let s = 0;
    for (const d of degs) {
      // shortest angular distance
      let diff = ((d - angle + 540) % 360) - 180;
      s += Math.exp(-(diff * diff) / twoVar);
    }
    out[i] = s / degs.length;
  }
  return out;
}

// ─── Clock face with KDE arcs + animated arrows ─────────────────────────

interface ClockDatum {
  pitch_type: string;
  tilt: number;          // mean spin direction in degrees (0 = 12 o'clock)
  count: number;
  rpm: number;           // avg spin rate
  density: number[];     // KDE per bin
}

function ClockFace({ data, size = 320 }: { data: ClockDatum[]; size?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  // refs to the rotating <g> per pitch type so we can spin them in a useFrame-like loop
  const arrowRefs = useRef<Array<SVGGElement | null>>([]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    arrowRefs.current = [];

    const cx = size / 2;
    const cy = size / 2;
    const rOuter = size / 2 - 32;       // clock edge
    const rDensity = rOuter + 4;         // KDE arc inner edge
    const rDensityOuter = rOuter + 16;   // KDE arc outer edge
    const rLabel = rDensityOuter + 10;   // pitch label radius

    // Outer KDE arcs — one ring per pitch type, partitioned by angle.
    // Stack each pitch type's arc in its own thin band so they don't overlap.
    const bandWidth = (rDensityOuter - rDensity) / Math.max(data.length, 1);
    data.forEach((d, idx) => {
      const color = PITCH_COLORS[d.pitch_type] ?? "#dc2626";
      const bins = d.density.length;
      const step = 360 / bins;
      const peak = Math.max(...d.density, 1e-9);
      const r1 = rDensity + idx * bandWidth;
      const r2 = r1 + bandWidth - 1;
      const arcGen = d3.arc<number>()
        .innerRadius(r1)
        .outerRadius(r2)
        .startAngle((b) => ((b * step - step / 2) * Math.PI) / 180)
        .endAngle((b) => ((b * step + step / 2) * Math.PI) / 180);
      svg.append("g").attr("transform", `translate(${cx},${cy})`)
        .selectAll("path")
        .data(d3.range(bins))
        .enter()
        .append("path")
        .attr("d", (b) => arcGen(b))
        .attr("fill", color)
        .attr("opacity", (b) => 0.15 + 0.85 * (d.density[b] / peak));
    });

    // Clock face
    svg.append("circle")
      .attr("cx", cx).attr("cy", cy).attr("r", rOuter)
      .attr("fill", "#fff")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 2);

    // Minute / hour ticks
    for (let h = 0; h < 60; h++) {
      const a = (h / 60) * 2 * Math.PI - Math.PI / 2;
      const isHour = h % 5 === 0;
      const r1 = isHour ? rOuter - 9 : rOuter - 4;
      svg.append("line")
        .attr("x1", cx + r1 * Math.cos(a)).attr("y1", cy + r1 * Math.sin(a))
        .attr("x2", cx + rOuter * Math.cos(a)).attr("y2", cy + rOuter * Math.sin(a))
        .attr("stroke", isHour ? "#0f172a" : "#94a3b8")
        .attr("stroke-width", isHour ? 1.6 : 0.7);
    }
    // Hour numerals
    for (let h = 1; h <= 12; h++) {
      const a = (h / 12) * 2 * Math.PI - Math.PI / 2;
      const tr = rOuter - 20;
      svg.append("text")
        .attr("x", cx + tr * Math.cos(a))
        .attr("y", cy + tr * Math.sin(a) + 4)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("font-weight", 700)
        .attr("fill", "#0f172a")
        .text(h);
    }
    // Centre hub
    svg.append("circle")
      .attr("cx", cx).attr("cy", cy).attr("r", 5)
      .attr("fill", "#0f172a");

    // Arrows: one rotating group per pitch type, anchored at centre.
    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(data, (d) => d.count) ?? 1])
      .range([1.8, 4.4]);

    data.forEach((d, idx) => {
      const color = PITCH_COLORS[d.pitch_type] ?? "#dc2626";
      const w = sizeScale(d.count);
      // Group rotated to the tilt direction (clock convention: tilt 0 = up = 12 o'clock,
      // clockwise positive). We orient the inner arrow line along +x then rotate by (tilt-90°).
      const g = svg.append("g")
        .attr("transform", `translate(${cx},${cy}) rotate(${d.tilt - 90})`);
      arrowRefs.current[idx] = g.node();

      // Shaft along +x
      const tipR = rOuter - 12;
      g.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", tipR).attr("y2", 0)
        .attr("stroke", color)
        .attr("stroke-width", w)
        .attr("stroke-linecap", "round");
      // Arrowhead — small triangle pointing along +x
      const ah = 11;
      g.append("polygon")
        .attr("points", `${tipR},0 ${tipR - ah},-${ah * 0.55} ${tipR - ah},${ah * 0.55}`)
        .attr("fill", color);

      // Clock label at the tip — placed in a *non-rotating* group so the text stays upright.
      const a = ((d.tilt - 90) * Math.PI) / 180;
      svg.append("text")
        .attr("x", cx + rLabel * Math.cos(a))
        .attr("y", cy + rLabel * Math.sin(a) + 4)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("font-weight", 700)
        .attr("fill", color)
        .text(degToClock(d.tilt));
    });
  }, [data, size]);

  // Animation loop: rotate each arrow group by avg_rpm, slowed ~120× so the
  // motion is visible to the naked eye and the inferred tilt (mean position)
  // remains readable.
  useEffect(() => {
    const SLOW = 120; // 120× slowdown
    let raf = 0;
    let last = performance.now();
    const phases = data.map(() => 0);
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      data.forEach((d, idx) => {
        const node = arrowRefs.current[idx];
        if (!node) return;
        // rev/s = rpm / 60. Slow down for visibility.
        const revPerSec = (d.rpm || 0) / 60 / SLOW;
        phases[idx] = (phases[idx] + revPerSec * 360 * dt) % 360;
        // Compose tilt orientation + spin phase. The "tilt" rotation is the
        // arrow's mean direction; the spin phase oscillates around it slightly
        // (±8°) to give the impression of the seam rotating without losing
        // the tilt readability.
        const wobble = Math.sin((phases[idx] * Math.PI) / 180) * 4;
        node.setAttribute(
          "transform",
          `translate(${size / 2},${size / 2}) rotate(${d.tilt - 90 + wobble})`,
        );
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data, size]);

  return <svg ref={svgRef} width={size} height={size} />;
}

// ─── Public component ───────────────────────────────────────────────────

export function SpinDirection({ points }: { points: SpinSpread[] }) {
  const rows = useMemo(
    () =>
      points
        .filter((p) => p.directions && p.directions.length > 0)
        .map((p) => ({
          ...p,
          tilt: meanAngle(p.directions),
          spread: circularStdDev(p.directions),
          density: circularKDE(p.directions, 72, 16),
        })),
    [points],
  );

  if (!rows.length) {
    return <div className="text-slate-700 py-6 text-center">沒有資料</div>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[340px_1fr] items-start">
      <div className="flex justify-center">
        <ClockFace
          data={rows.map((r) => ({
            pitch_type: r.pitch_type,
            tilt: r.tilt,
            count: r.count,
            rpm: r.avg_spin ?? 0,
            density: r.density,
          }))}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-800 border-b border-slate-300">
            <tr>
              <th className="text-left py-2 pr-2 font-semibold">球種</th>
              <th className="text-right px-2 font-semibold">球數</th>
              <th className="text-right px-2 font-semibold">轉速 (rpm)</th>
              <th className="text-right px-2 font-semibold">推算 Tilt</th>
              <th className="text-right px-2 font-semibold">分散 (°)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pitch_type} className="border-b border-slate-100">
                <td className="py-1.5 pr-2">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ background: PITCH_COLORS[r.pitch_type] ?? "#888" }}
                    />
                    <span
                      className="font-bold"
                      style={{ color: PITCH_COLORS[r.pitch_type] ?? "#0f172a" }}
                    >
                      {r.pitch_type}
                    </span>
                  </span>
                </td>
                <td className="text-right tabular-nums">{r.count}</td>
                <td className="text-right tabular-nums">
                  {r.avg_spin?.toFixed(0) ?? "—"}
                </td>
                <td className="text-right tabular-nums font-bold text-slate-900">
                  {degToClock(r.tilt)}
                </td>
                <td className="text-right tabular-nums">
                  ±{r.spread.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
