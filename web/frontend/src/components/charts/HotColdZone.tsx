"use client";

/**
 * 3×3 strike-zone "hot/cold" heatmap, shaded by a stat (wOBA / SLG / BA).
 *
 *   Cell colour: red = hot (high), blue = cold (low), grey = neutral.
 *   Cell text:   the stat value + AB count.
 */
import * as d3 from "d3";
import { useEffect, useRef } from "react";

type Metric = "woba" | "slg" | "ba";

interface ZoneCell {
  col: number;
  row: number;
  ab: number;
  hits: number;
  pa: number;
  ba: number;
  slg: number;
  woba: number;
}

interface Props {
  cells: ZoneCell[];
  metric?: Metric;
  width?: number;
  height?: number;
  title?: string;
}

const METRIC_LABEL: Record<Metric, string> = {
  woba: "wOBA",
  slg: "SLG",
  ba: "BA",
};

// Diverging scale: blue (cold) ↔ neutral grey ↔ red (hot).
function colorScale(metric: Metric): d3.ScaleDiverging<string> {
  const lo: Record<Metric, number> = { woba: 0.2, slg: 0.25, ba: 0.15 };
  const mid: Record<Metric, number> = { woba: 0.32, slg: 0.4, ba: 0.25 };
  const hi: Record<Metric, number> = { woba: 0.5, slg: 0.6, ba: 0.4 };
  return d3
    .scaleDiverging<string>()
    .domain([lo[metric], mid[metric], hi[metric]])
    .interpolator(d3.interpolateRdBu)
    .clamp(true);
}

export function HotColdZone({
  cells,
  metric = "woba",
  width = 230,
  height = 280,
  title,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const m = { top: 22, right: 8, bottom: 30, left: 8 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const cellW = w / 3;
    const cellH = h / 3;
    // Reverse color: scaleDiverging RdBu = blue→white→red, so we invert
    // by flipping the input.
    const cs = colorScale(metric);
    cells.forEach((c) => {
      const cx = c.col * cellW;
      const cy = (2 - c.row) * cellH;
      const v = (c[metric] as number) || 0;
      const fill = c.ab > 0 ? cs(v) : "#f1f5f9";
      // Note: scaleDiverging(RdBu) is blue→red, but red is "cold" in
      // the stock palette. Invert by mirror around the midpoint:
      const mid = cs.domain()[1];
      const mirrored = 2 * mid - v;
      const properFill = c.ab > 0 ? cs(mirrored) : "#f1f5f9";
      void fill;
      g.append("rect")
        .attr("x", cx)
        .attr("y", cy)
        .attr("width", cellW - 1)
        .attr("height", cellH - 1)
        .attr("fill", properFill)
        .attr("stroke", "#1f2937")
        .attr("stroke-width", 0.6);
      const isDark =
        v >= cs.domain()[2] - 0.05 || v <= cs.domain()[0] + 0.05;
      g.append("text")
        .attr("x", cx + cellW / 2)
        .attr("y", cy + cellH / 2 - 4)
        .attr("text-anchor", "middle")
        .attr("font-size", 16)
        .attr("font-weight", 800)
        .attr("fill", isDark && c.ab > 0 ? "#fff" : "#0f172a")
        .text(c.ab > 0 ? v.toFixed(3) : "—");
      g.append("text")
        .attr("x", cx + cellW / 2)
        .attr("y", cy + cellH / 2 + 12)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("fill", isDark && c.ab > 0 ? "#ffffffcc" : "#475569")
        .text(`${c.hits}/${c.ab}`);
    });

    if (title) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", 14)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("font-weight", 700)
        .attr("fill", "#0f172a")
        .text(title);
    }
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", "#475569")
      .text(`${METRIC_LABEL[metric]} 熱區（捕手視角；紅=熱、藍=冷）`);
  }, [cells, metric, width, height, title]);

  return <svg ref={ref} width={width} height={height} />;
}
