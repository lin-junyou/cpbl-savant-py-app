"use client";

/**
 * Two donut charts side-by-side: batted-ball type (GB/LD/FB/PU) and field
 * distribution (Pull/Center/Oppo).
 */
import * as d3 from "d3";
import { useEffect, useRef } from "react";

interface Props {
  data: {
    n: number;
    batted_ball_types: Record<"GB" | "LD" | "FB" | "PU", number>;
    field_distribution: Record<"Pull" | "Center" | "Oppo", number>;
  };
}

const COLORS_BB: Record<string, string> = {
  GB: "#a16207", LD: "#dc2626", FB: "#2563eb", PU: "#94a3b8",
};
const COLORS_FIELD: Record<string, string> = {
  Pull: "#dc2626", Center: "#16a34a", Oppo: "#2563eb",
};

function Donut({
  data, colors, title, size = 220,
}: {
  data: Record<string, number>;
  colors: Record<string, string>;
  title: string;
  size?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const r = size / 2 - 12;
    const inner = r * 0.55;
    const cx = size / 2;
    const cy = size / 2;
    const total = d3.sum(Object.values(data));
    if (!total) return;
    const entries = Object.entries(data).filter(([, v]) => v > 0);
    const arcGen = d3.arc<{ start: number; end: number; key: string; v: number }>()
      .innerRadius(inner).outerRadius(r)
      .startAngle((d) => d.start)
      .endAngle((d) => d.end);
    let cursor = 0;
    const segs = entries.map(([k, v]) => {
      const start = cursor;
      cursor += (v / total) * 2 * Math.PI;
      return { start, end: cursor, key: k, v };
    });
    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);
    g.selectAll("path").data(segs).enter().append("path")
      .attr("d", (d) => arcGen(d))
      .attr("fill", (d) => colors[d.key] ?? "#888")
      .attr("stroke", "#fff").attr("stroke-width", 1.5);
    // Center text
    g.append("text").attr("text-anchor", "middle").attr("y", -4)
      .attr("font-size", 11).attr("fill", "#475569").text(title);
    g.append("text").attr("text-anchor", "middle").attr("y", 14)
      .attr("font-size", 16).attr("font-weight", 700).attr("fill", "#0f172a")
      .text(`n=${total}`);
    // Labels around the ring
    segs.forEach((s) => {
      const a = (s.start + s.end) / 2 - Math.PI / 2;
      const lr = r + 6;
      g.append("text")
        .attr("x", lr * Math.cos(a))
        .attr("y", lr * Math.sin(a) + 4)
        .attr("text-anchor", a > Math.PI / 2 || a < -Math.PI / 2 ? "end" : "start")
        .attr("font-size", 10)
        .attr("fill", colors[s.key] ?? "#0f172a")
        .text(`${s.key} ${((s.v / total) * 100).toFixed(0)}%`);
    });
  }, [data, colors, title, size]);
  return <svg ref={ref} width={size} height={size} />;
}

export function BattedBallPie({ data }: Props) {
  if (!data || data.n === 0) {
    return <div className="text-slate-700 py-6 text-center">沒有擊球資料</div>;
  }
  return (
    <div className="flex flex-wrap gap-6 items-center">
      <Donut data={data.batted_ball_types} colors={COLORS_BB} title="擊球類型" />
      <Donut data={data.field_distribution} colors={COLORS_FIELD} title="守備方向" />
      <div className="text-xs text-slate-700 max-w-xs">
        擊球類型：GB 滾地、LD 平飛、FB 高飛、PU 內野高飛。
        守備方向：Pull 拉打 (bearing &lt; -15°)、Center 中央、Oppo 推打 (bearing &gt; 15°)。
      </div>
    </div>
  );
}
