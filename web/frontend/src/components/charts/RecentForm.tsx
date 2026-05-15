"use client";

/**
 * Recent-form trend chart — line of a chosen metric across the last N games.
 */
import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";

type Row = Record<string, number | string | null>;

interface Props {
  rows: Row[];
  role: "pitcher" | "hitter";
  width?: number;
  height?: number;
}

const PITCHER_METRICS: Array<[string, string]> = [
  ["era", "ERA"],
  ["whip", "WHIP"],
  ["strike_out_cnt", "K"],
  ["bb", "BB"],
];
const HITTER_METRICS: Array<[string, string]> = [
  ["hits", "H"],
  ["home_run_cnt", "HR"],
  ["rbi", "RBI"],
  ["bb", "BB"],
  ["strike_out_cnt", "K"],
];

export function RecentForm({ rows, role, width = 720, height = 280 }: Props) {
  const metrics = role === "pitcher" ? PITCHER_METRICS : HITTER_METRICS;
  const [metric, setMetric] = useState(metrics[0][0]);
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !rows.length) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const m = { top: 16, right: 24, bottom: 32, left: 40 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const data = rows
      .map((r) => ({
        date: r.date as string,
        v:
          typeof r[metric] === "number"
            ? (r[metric] as number)
            : Number(r[metric]) || 0,
      }))
      .filter((d) => d.date);

    const x = d3.scalePoint<string>()
      .domain(data.map((d) => d.date))
      .range([0, w])
      .padding(0.5);
    const yMax = Math.max(...data.map((d) => d.v), 1);
    const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([h, 0]);

    g.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickValues(
        data.filter((_, i) => i % Math.ceil(data.length / 8) === 0).map((d) => d.date),
      ))
      .selectAll("text").attr("font-size", 9).attr("fill", "#475569");
    g.append("g").call(d3.axisLeft(y).ticks(5))
      .selectAll("text").attr("font-size", 9).attr("fill", "#475569");

    const line = d3.line<{ date: string; v: number }>()
      .x((d) => x(d.date)!)
      .y((d) => y(d.v));

    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#dc2626")
      .attr("stroke-width", 2)
      .attr("d", line);

    g.selectAll(".dot").data(data).enter().append("circle")
      .attr("cx", (d) => x(d.date)!)
      .attr("cy", (d) => y(d.v))
      .attr("r", 3.5)
      .attr("fill", "#dc2626")
      .append("title")
      .text((d) => `${d.date} — ${metric}: ${d.v}`);

    // Rolling avg
    const window = 5;
    const roll = data.map((_, i) => {
      const slice = data.slice(Math.max(0, i - window + 1), i + 1);
      return {
        date: data[i].date,
        v: slice.reduce((s, x) => s + x.v, 0) / slice.length,
      };
    });
    g.append("path")
      .datum(roll)
      .attr("fill", "none")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 1.4)
      .attr("stroke-dasharray", "4,3")
      .attr("d", line);
  }, [rows, metric, width, height]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs">
        {metrics.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setMetric(k)}
            className={`px-2 py-1 rounded border ${
              metric === k
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <svg ref={ref} width={width} height={height} />
      <p className="text-xs text-slate-700">
        紅線 = 每場數值；黑虛線 = 5 場滾動平均（趨勢）
      </p>
    </div>
  );
}
