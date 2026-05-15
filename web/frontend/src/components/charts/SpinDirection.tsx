"use client";

/**
 * Baseball Savant-style Spin Direction widget.
 *
 * Reference layout (Ohtani's pitching page):
 *   • A table per pitch type — pitches, avg spin (rpm), inferred tilt.
 *   • A SINGLE overlaid clock face with one coloured arrow per pitch type.
 *
 * Savant also shows a "measured tilt" column (from Trackman gyroscope),
 * which would let them compute Active Spin %. CPBL Trackman doesn't expose
 * that field so we only show the *inferred* tilt (derived from the
 * magnus deflection in the ball's trajectory).
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

function degToClock(deg: number): string {
  const totalMin = Math.round((deg / 360) * 12 * 60);
  let hh = Math.floor(totalMin / 60) || 12;
  if (hh === 0) hh = 12;
  const mm = totalMin % 60;
  return `${hh}:${mm.toString().padStart(2, "0")}`;
}

interface ClockProps {
  data: Array<{ pitch_type: string; tilt: number; count: number }>;
  size?: number;
}

/** Single clock face with one arrow per pitch type, colour-coded. */
function MultiClock({ data, size = 280 }: ClockProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 26;

    // Clock face
    svg.append("circle")
      .attr("cx", cx).attr("cy", cy).attr("r", r)
      .attr("fill", "#fff")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 2);

    // Hour ticks
    for (let h = 0; h < 60; h++) {
      const a = (h / 60) * 2 * Math.PI - Math.PI / 2;
      const isHour = h % 5 === 0;
      const r1 = isHour ? r - 8 : r - 4;
      svg.append("line")
        .attr("x1", cx + r1 * Math.cos(a)).attr("y1", cy + r1 * Math.sin(a))
        .attr("x2", cx + r * Math.cos(a)).attr("y2", cy + r * Math.sin(a))
        .attr("stroke", isHour ? "#0f172a" : "#94a3b8")
        .attr("stroke-width", isHour ? 1.6 : 0.7);
    }
    // Hour numerals 1-12
    for (let h = 1; h <= 12; h++) {
      const a = (h / 12) * 2 * Math.PI - Math.PI / 2;
      const tr = r - 18;
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

    // Arrow per pitch type
    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(data, (d) => d.count) ?? 1])
      .range([1.6, 4.2]);
    data.forEach((d) => {
      const color = PITCH_COLORS[d.pitch_type] ?? "#dc2626";
      const a = ((d.tilt - 90) * Math.PI) / 180;
      const tipR = r - 10;
      const tipX = cx + tipR * Math.cos(a);
      const tipY = cy + tipR * Math.sin(a);
      const w = sizeScale(d.count);
      svg.append("line")
        .attr("x1", cx).attr("y1", cy)
        .attr("x2", tipX).attr("y2", tipY)
        .attr("stroke", color)
        .attr("stroke-width", w)
        .attr("stroke-linecap", "round");
      // Arrowhead
      const ah = 10;
      const ang1 = a + Math.PI - 0.45;
      const ang2 = a + Math.PI + 0.45;
      svg.append("polygon")
        .attr("points",
          `${tipX},${tipY} ${tipX + ah * Math.cos(ang1)},${tipY + ah * Math.sin(ang1)} ${tipX + ah * Math.cos(ang2)},${tipY + ah * Math.sin(ang2)}`)
        .attr("fill", color);
      // Pitch type label at the tip
      const labelR = r + 12;
      svg.append("text")
        .attr("x", cx + labelR * Math.cos(a))
        .attr("y", cy + labelR * Math.sin(a) + 4)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("font-weight", 700)
        .attr("fill", color)
        .text(degToClock(d.tilt));
    });
  }, [data, size]);

  return <svg ref={ref} width={size} height={size} />;
}

export function SpinDirection({ points }: { points: SpinSpread[] }) {
  const rows = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        tilt: meanAngle(p.directions),
        spread: stdDev(p.directions),
      })),
    [points],
  );

  if (!rows.length) {
    return <div className="text-slate-600 py-6 text-center">沒有資料</div>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr] items-start">
      <div className="flex justify-center">
        <MultiClock
          data={rows.map((r) => ({
            pitch_type: r.pitch_type,
            tilt: r.tilt,
            count: r.count,
          }))}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-700 border-b">
            <tr>
              <th className="text-left py-2 pr-2">球種</th>
              <th className="text-right px-2">球數</th>
              <th className="text-right px-2">轉速 (rpm)</th>
              <th className="text-right px-2">推算 Tilt</th>
              <th className="text-right px-2">分散 (°)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pitch_type} className="border-b">
                <td className="py-1.5 pr-2">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ background: PITCH_COLORS[r.pitch_type] ?? "#888" }}
                    />
                    <span
                      className="font-semibold"
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
        <p className="mt-3 text-xs text-slate-700">
          推算 Tilt（Inferred Spin Direction）= 從觀察到的 magnus 球路位移
          反推的旋轉方向。Savant 同時提供 Measured Tilt（gyroscope 直接量
          測），兩者差距 = Active Spin%（CPBL Trackman 不公開測量值，僅顯示推算）。
        </p>
      </div>
    </div>
  );
}

function stdDev(xs: number[]): number {
  if (!xs.length) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}
