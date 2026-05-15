"use client";

/**
 * Density heatmap of batted-ball landing positions overlaid on a baseball
 * field outline. Replaces the dot scatter with a "where are balls hit"
 * visualisation suitable for season-long park studies.
 */
import * as d3 from "d3";
import { useEffect, useRef } from "react";

interface Props {
  cells: number[][];
  grid: number;
  L: number; // half-width in metres
  width?: number;
  height?: number;
}

export function StadiumDensity({
  cells,
  grid,
  L,
  width = 540,
  height = 480,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const m = { top: 16, right: 16, bottom: 32, left: 32 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const x = d3.scaleLinear().domain([-L, L]).range([0, w]);
    const y = d3.scaleLinear().domain([-15, L + 15]).range([h, 0]);

    // Foul lines + fence overlay
    const r45 = Math.PI / 4;
    const fenceL = 99;
    const fenceC = 122;
    const fenceR = 99;
    const fence = d3.range(-45, 46, 2).map((deg) => {
      const a = (deg * Math.PI) / 180;
      const r =
        deg < 0
          ? fenceL + ((fenceC - fenceL) * (deg + 45)) / 45
          : fenceC + ((fenceR - fenceC) * deg) / 45;
      return [x(r * Math.sin(a)), y(r * Math.cos(a))] as [number, number];
    });

    // Heatmap cells (only inside reasonable area)
    const max = d3.max(cells.flat()) ?? 1;
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, max]);
    const cellW = w / grid;
    const cellH = h / grid;
    cells.forEach((row, ri) => {
      row.forEach((v, ci) => {
        if (v === 0) return;
        // Convert grid index back to coordinates
        const cx = ci * cellW;
        const cy = (grid - 1 - ri) * cellH;
        g.append("rect")
          .attr("x", cx)
          .attr("y", cy)
          .attr("width", cellW + 0.5)
          .attr("height", cellH + 0.5)
          .attr("fill", color(v) || "#fff")
          .attr("opacity", 0.85);
      });
    });

    // Field outline ON TOP of heatmap
    g.append("line")
      .attr("x1", x(0)).attr("y1", y(0))
      .attr("x2", x(-fenceL * Math.sin(r45)))
      .attr("y2", y(fenceL * Math.cos(r45)))
      .attr("stroke", "#0f172a").attr("stroke-width", 1.5);
    g.append("line")
      .attr("x1", x(0)).attr("y1", y(0))
      .attr("x2", x(fenceR * Math.sin(r45)))
      .attr("y2", y(fenceR * Math.cos(r45)))
      .attr("stroke", "#0f172a").attr("stroke-width", 1.5);
    g.append("path")
      .datum(fence).attr("d", d3.line())
      .attr("fill", "none").attr("stroke", "#0f172a").attr("stroke-width", 2);
    // Infield diamond
    const base = 27.4;
    g.append("path")
      .attr("d", `M${x(0)},${y(0)} L${x(base/Math.sqrt(2))},${y(base/Math.sqrt(2))} L${x(0)},${y(base*Math.sqrt(2))} L${x(-base/Math.sqrt(2))},${y(base/Math.sqrt(2))} Z`)
      .attr("fill", "none").attr("stroke", "#0f172a").attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,2");

    // Color legend
    const legendX = w - 80;
    const legendY = 0;
    const legendH = 100;
    const lg = svg.append("g")
      .attr("transform", `translate(${m.left + legendX},${m.top + legendY})`);
    const stops = 20;
    for (let i = 0; i < stops; i++) {
      lg.append("rect")
        .attr("x", 0).attr("y", (i * legendH) / stops)
        .attr("width", 12).attr("height", legendH / stops + 0.5)
        .attr("fill", color(((stops - i) / stops) * max));
    }
    lg.append("text").attr("x", 16).attr("y", 6)
      .attr("font-size", 10).attr("fill", "#0f172a")
      .text(`${max}`);
    lg.append("text").attr("x", 16).attr("y", legendH)
      .attr("font-size", 10).attr("fill", "#0f172a").text("0");
  }, [cells, grid, L, width, height]);

  return <svg ref={ref} width={width} height={height} />;
}
