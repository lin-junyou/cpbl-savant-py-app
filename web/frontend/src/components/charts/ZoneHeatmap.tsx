"use client";

/**
 * 3×3 strike-zone heatmap. Renders an SVG grid where each cell is shaded by
 * the chosen metric (pitches / swings / whiffs / hits). The grid is shown
 * from the catcher's perspective (positive plate side on the right).
 */
import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { ZoneCell } from "@/lib/api";

type Metric = "pitches" | "swings" | "whiffs" | "in_play" | "hits";

interface Props {
  cells: ZoneCell[];
  metric?: Metric;
  /** Display the value as a rate of pitches (whiff% etc.) instead of count. */
  asRate?: boolean;
  width?: number;
  height?: number;
  title?: string;
}

const METRIC_LABEL: Record<Metric, string> = {
  pitches: "球數",
  swings: "揮棒",
  whiffs: "揮空",
  in_play: "擊入場",
  hits: "安打",
};

export function ZoneHeatmap({
  cells,
  metric = "pitches",
  asRate = false,
  width = 220,
  height = 260,
  title,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const m = { top: 18, right: 8, bottom: 24, left: 8 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const cellW = w / 3;
    const cellH = h / 3;

    const values = cells.map((c) => {
      if (asRate && c.pitches > 0) return c[metric] / c.pitches;
      return c[metric];
    });
    const max = d3.max(values) ?? 1;
    const color = d3.scaleSequential(d3.interpolateReds).domain([0, max || 1]);

    cells.forEach((c) => {
      // c.col 0 = catcher's left (negative side); row 0 = bottom (low pitch)
      const cx = c.col * cellW;
      // Flip row so row 2 (top) appears on top of SVG
      const cy = (2 - c.row) * cellH;
      const v = asRate && c.pitches > 0 ? c[metric] / c.pitches : c[metric];
      const display =
        asRate && c.pitches > 0
          ? `${((c[metric] / c.pitches) * 100).toFixed(0)}%`
          : String(c[metric] || 0);
      g.append("rect")
        .attr("x", cx)
        .attr("y", cy)
        .attr("width", cellW - 1)
        .attr("height", cellH - 1)
        .attr("fill", color(v) || "#f3f4f6")
        .attr("stroke", "#1f2937")
        .attr("stroke-width", 0.6);
      g.append("text")
        .attr("x", cx + cellW / 2)
        .attr("y", cy + cellH / 2 - 4)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .attr("font-weight", 700)
        .attr("fill", v > max * 0.5 ? "#fff" : "#0f172a")
        .text(display);
      g.append("text")
        .attr("x", cx + cellW / 2)
        .attr("y", cy + cellH / 2 + 11)
        .attr("text-anchor", "middle")
        .attr("font-size", 9)
        .attr("fill", v > max * 0.5 ? "#ffffffcc" : "#475569")
        .text(`${c.pitches} 球`);
    });

    if (title) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", 13)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("font-weight", 600)
        .attr("fill", "#0f172a")
        .text(title);
    }
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", "#475569")
      .text(`${METRIC_LABEL[metric]}${asRate ? " %（佔球數）" : "（次）"} — 捕手視角`);
  }, [cells, metric, asRate, width, height, title]);

  return <svg ref={svgRef} width={width} height={height} />;
}
