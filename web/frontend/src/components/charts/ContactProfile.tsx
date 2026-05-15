"use client";

/**
 * 3D contact-position scatter plus hit-spin and hang-time histograms.
 *
 *   Contact view (y=height, x=side from catcher view):
 *     X axis = contact_z (side, m, +=catcher right after sign flip)
 *     Y axis = contact_y (height of bat-ball collision, m)
 *
 *   Hit-spin: distribution of batted-ball spin (rpm).
 *   Hang-time: distribution of flight time (s) — useful for fielder/positioning analysis.
 */
import * as d3 from "d3";
import { useEffect, useRef } from "react";

type Row = {
  contact_x: number;
  contact_y: number;
  contact_z: number;
  hit_spin_rate: number | null;
  hit_exit_speed_kph: number | null;
  hit_launch_angle: number | null;
  land_distance_m: number | null;
  land_hang_time: number | null;
  content: string | null;
};

interface Props {
  rows: Row[];
  width?: number;
  height?: number;
}

function outcomeColor(content: string | null): string {
  if (!content) return "#94a3b8";
  if (content.includes("全壘打")) return "#dc2626";
  if (content.includes("二壘安打")) return "#2563eb";
  if (content.includes("安打")) return "#16a34a";
  return "#cbd5e1";
}

function ContactScatter({ rows, width = 380, height = 380 }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const m = { top: 14, right: 14, bottom: 36, left: 40 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    if (!rows.length) {
      g.append("text").attr("x", w / 2).attr("y", h / 2)
        .attr("text-anchor", "middle").attr("fill", "#94a3b8")
        .text("沒有接觸點資料");
      return;
    }
    // Flip contact_z to catcher view (positive = catcher right)
    const x = d3.scaleLinear().domain([-1.2, 1.2]).range([0, w]);
    const y = d3.scaleLinear().domain([0, 2]).range([h, 0]);

    g.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(-h))
      .selectAll("line").attr("stroke", "#e5e7eb");
    g.append("g").call(d3.axisLeft(y).ticks(6).tickSize(-w))
      .selectAll("line").attr("stroke", "#e5e7eb");
    g.selectAll("path.domain").attr("stroke", "#94a3b8");

    g.selectAll(".pt").data(rows).enter().append("circle")
      .attr("cx", (d) => x(-d.contact_z))
      .attr("cy", (d) => y(d.contact_y))
      .attr("r", (d) => d.hit_exit_speed_kph ? Math.max(2, (d.hit_exit_speed_kph - 90) / 25) : 3)
      .attr("fill", (d) => outcomeColor(d.content))
      .attr("opacity", 0.65)
      .attr("stroke", "#0f172a").attr("stroke-width", 0.4)
      .append("title").text((d) =>
        `${d.content?.slice(0, 30) ?? ""}\n` +
        `Contact (${d.contact_x.toFixed(2)}, ${d.contact_y.toFixed(2)}, ${d.contact_z.toFixed(2)}) m\n` +
        `EV ${d.hit_exit_speed_kph?.toFixed(1)} kph · LA ${d.hit_launch_angle?.toFixed(1)}°`,
      );

    svg.append("text").attr("x", width / 2).attr("y", height - 6)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#475569")
      .text("接觸點 側向 (m, +捕手右)");
    svg.append("text").attr("transform", `translate(12,${height/2}) rotate(-90)`)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#475569")
      .text("接觸點 高度 (m)");
  }, [rows, width, height]);
  return <svg ref={ref} width={width} height={height} />;
}

function MiniHist({ values, color, xLabel, refs, width = 320, height = 180 }:
  { values: number[]; color: string; xLabel: string; refs?: number[]; width?: number; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !values.length) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const m = { top: 12, right: 10, bottom: 28, left: 36 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const x = d3.scaleLinear().domain(d3.extent(values) as [number, number]).nice().range([0, w]);
    const histo = d3.bin().domain(x.domain() as [number, number]).thresholds(20);
    const bs = histo(values);
    const y = d3.scaleLinear().domain([0, d3.max(bs, (b) => b.length) ?? 1]).range([h, 0]);
    g.selectAll("rect").data(bs).enter().append("rect")
      .attr("x", (d) => x(d.x0 ?? 0)).attr("y", (d) => y(d.length))
      .attr("width", (d) => Math.max(1, x(d.x1 ?? 0) - x(d.x0 ?? 0) - 1))
      .attr("height", (d) => h - y(d.length))
      .attr("fill", color).attr("opacity", 0.85);
    refs?.forEach((r) => {
      g.append("line").attr("x1", x(r)).attr("x2", x(r))
        .attr("y1", 0).attr("y2", h)
        .attr("stroke", "#0f172a").attr("stroke-dasharray", "3,2");
    });
    g.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(5)).selectAll("text").attr("font-size", 9).attr("fill", "#475569");
    g.append("g").call(d3.axisLeft(y).ticks(4)).selectAll("text").attr("font-size", 9).attr("fill", "#475569");
    svg.append("text").attr("x", width/2).attr("y", height - 4)
      .attr("text-anchor", "middle").attr("font-size", 10).attr("fill", "#475569").text(xLabel);
  }, [values, color, xLabel, refs, width, height]);
  return <svg ref={ref} width={width} height={height} />;
}

export function ContactProfile({ rows, width, height }: Props) {
  const spins = rows.map((r) => r.hit_spin_rate).filter((v): v is number => v != null);
  const hangs = rows.map((r) => r.land_hang_time).filter((v): v is number => v != null);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">接觸點 (Contact Position) — 捕手視角</div>
          <ContactScatter rows={rows} width={width} height={height} />
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">擊球後 spin (rpm) ｜ n={spins.length}</div>
            <MiniHist values={spins} color="#7c3aed" xLabel="rpm" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">滯空時間 hang time (s) ｜ n={hangs.length}</div>
            <MiniHist values={hangs} color="#16a34a" xLabel="seconds" />
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-700">
        接觸點的 X = 前後（負值=接觸點在本壘前方=「打早」），Y = 高度（揮棒平面），Z = 側向。
        擊球後 spin 高 = 揮棒切到球邊緣（容易產生平飛/側旋飛球）；hang time 反映飛行軌跡的高度與距離。
      </p>
    </div>
  );
}
