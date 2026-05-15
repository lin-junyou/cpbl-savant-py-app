"use client";

/**
 * Home Run analysis for a stadium:
 *   • Distance histogram
 *   • Polar chart of HR landing direction (bearing)
 *   • Top 10 longest table
 */
import * as d3 from "d3";
import { useEffect, useRef } from "react";
import { Histogram } from "./Histogram";

interface HR {
  hitter_name: string | null;
  pitcher_name: string | null;
  hit_exit_speed_kph: number | null;
  hit_launch_angle: number | null;
  land_distance_m: number | null;
  land_bearing: number | null;
  content: string | null;
  date: string;
  auto_pitch_type: string | null;
}

interface Props {
  hrs: HR[];
}

function PolarHR({ hrs, size = 360 }: { hrs: HR[]; size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const cx = size / 2;
    const cy = size / 2 + 12;
    const maxR = size / 2 - 20;
    const maxDist = d3.max(hrs, (d) => d.land_distance_m ?? 0) ?? 130;

    // Concentric distance rings
    [50, 80, 100, 120, 140].forEach((d) => {
      svg.append("circle").attr("cx", cx).attr("cy", cy)
        .attr("r", (d / maxDist) * maxR)
        .attr("fill", "none").attr("stroke", "#cbd5e1")
        .attr("stroke-dasharray", "2,2");
      svg.append("text").attr("x", cx + 2).attr("y", cy - (d / maxDist) * maxR)
        .attr("font-size", 9).attr("fill", "#94a3b8").text(`${d}m`);
    });
    // Foul lines (±45°)
    [-45, 45].forEach((deg) => {
      const a = (deg * Math.PI) / 180 - Math.PI / 2;
      svg.append("line")
        .attr("x1", cx).attr("y1", cy)
        .attr("x2", cx + maxR * Math.cos(a))
        .attr("y2", cy + maxR * Math.sin(a))
        .attr("stroke", "#0f172a").attr("stroke-width", 1);
    });
    // Direction labels
    [["LF", -45], ["L", -22], ["C", 0], ["R", 22], ["RF", 45]].forEach(([l, deg]) => {
      const a = ((deg as number) * Math.PI) / 180 - Math.PI / 2;
      svg.append("text")
        .attr("x", cx + (maxR + 10) * Math.cos(a))
        .attr("y", cy + (maxR + 10) * Math.sin(a) + 3)
        .attr("text-anchor", "middle").attr("font-size", 10)
        .attr("fill", "#475569").text(l as string);
    });

    // Plot HRs
    hrs.forEach((d) => {
      if (d.land_bearing == null || d.land_distance_m == null) return;
      const a = (d.land_bearing * Math.PI) / 180 - Math.PI / 2;
      const r = (d.land_distance_m / maxDist) * maxR;
      svg.append("circle")
        .attr("cx", cx + r * Math.cos(a))
        .attr("cy", cy + r * Math.sin(a))
        .attr("r", Math.max(3, ((d.hit_exit_speed_kph ?? 150) - 130) / 10))
        .attr("fill", "#dc2626")
        .attr("opacity", 0.7)
        .attr("stroke", "#7f1d1d").attr("stroke-width", 0.6)
        .append("title")
        .text(`${d.hitter_name} ${d.land_distance_m.toFixed(0)}m · EV ${d.hit_exit_speed_kph?.toFixed(1)} kph`);
    });

    svg.append("text")
      .attr("x", cx).attr("y", 12)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 700)
      .attr("fill", "#0f172a").text(`${hrs.length} 支全壘打分佈`);
  }, [hrs, size]);
  return <svg ref={ref} width={size} height={size} />;
}

export function HRAnalysis({ hrs }: Props) {
  if (!hrs || hrs.length === 0) {
    return <div className="text-slate-700 py-6 text-center">這裡還沒人打過全壘打</div>;
  }
  const distances = hrs
    .map((h) => h.land_distance_m)
    .filter((v): v is number => v != null);
  const evs = hrs
    .map((h) => h.hit_exit_speed_kph)
    .filter((v): v is number => v != null);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[360px_1fr] items-start">
        <PolarHR hrs={hrs} />
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">飛行距離 (m)</div>
            <Histogram values={distances} color="#dc2626" width={420} height={180} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">擊球初速 (kph)</div>
            <Histogram values={evs} color="#f97316" width={420} height={180} />
          </div>
        </div>
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-700 mb-2">最遠 10 支</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-700 border-b">
              <tr>
                <th className="text-left py-2">日期</th>
                <th className="text-left py-2">打者</th>
                <th className="text-left py-2">投手</th>
                <th className="text-left py-2">球種</th>
                <th className="text-right py-2">距離 (m)</th>
                <th className="text-right py-2">EV (kph)</th>
                <th className="text-right py-2">仰角 °</th>
              </tr>
            </thead>
            <tbody>
              {hrs.slice(0, 10).map((h, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1.5 text-slate-700">{h.date}</td>
                  <td className="py-1.5 font-medium">{h.hitter_name}</td>
                  <td className="py-1.5">{h.pitcher_name}</td>
                  <td className="py-1.5 text-slate-700">{h.auto_pitch_type ?? "—"}</td>
                  <td className="text-right tabular-nums font-bold">
                    {h.land_distance_m?.toFixed(0) ?? "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {h.hit_exit_speed_kph?.toFixed(1) ?? "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {h.hit_launch_angle?.toFixed(1) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
