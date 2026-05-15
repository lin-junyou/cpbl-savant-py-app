"use client";

/**
 * Savant-style pitch movement chart.
 *
 * Each pitch is plotted as a circle with:
 *   x = horizontal break (cm, + = catcher's right / RHB inside)
 *   y = induced vertical break (cm, + = upward "rise" vs gravity)
 *   color = pitch type
 *   size  = √(usage)  (so common pitch types appear larger)
 *
 * The chart is shown from the catcher's perspective. Origin crosshair
 * is included so the viewer can read absolute break magnitudes.
 */
import * as d3 from "d3";
import { useEffect, useRef } from "react";
import { PITCH_COLORS } from "./StrikeZone";

export interface MovementPoint {
  pitch_type: string;
  /** cm */
  horiz: number;
  /** cm, induced vertical break */
  vert: number;
  /** Number of pitches (used for sizing) */
  count: number;
  avg_kph?: number;
  spin?: number;
}

interface Props {
  points: MovementPoint[];
  width?: number;
  height?: number;
}

export function PitchMovement({ points, width = 420, height = 420 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 36, left: 40 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Symmetric domain so the origin sits in the middle.
    const maxAbs = d3.max(points.flatMap((p) => [Math.abs(p.horiz), Math.abs(p.vert)])) ?? 60;
    const lim = Math.max(60, Math.ceil(maxAbs / 10) * 10 + 5);
    const x = d3.scaleLinear().domain([-lim, lim]).range([0, w]);
    const y = d3.scaleLinear().domain([-lim, lim]).range([h, 0]);

    // Background grid
    const grid = d3.axisBottom(x).tickSize(-h).ticks(8).tickFormat(() => "");
    g.append("g").attr("transform", `translate(0,${h})`).call(grid)
      .selectAll("line").attr("stroke", "#e5e7eb");
    const grid2 = d3.axisLeft(y).tickSize(-w).ticks(8).tickFormat(() => "");
    g.append("g").call(grid2).selectAll("line").attr("stroke", "#e5e7eb");
    g.selectAll("path.domain").attr("stroke", "transparent");

    // Origin crosshair
    g.append("line")
      .attr("x1", x(0)).attr("x2", x(0)).attr("y1", 0).attr("y2", h)
      .attr("stroke", "#94a3b8").attr("stroke-width", 1);
    g.append("line")
      .attr("x1", 0).attr("x2", w).attr("y1", y(0)).attr("y2", y(0))
      .attr("stroke", "#94a3b8").attr("stroke-width", 1);

    // Points
    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(points, (d) => d.count) ?? 1])
      .range([6, 28]);

    const groups = g.selectAll(".pt").data(points).enter().append("g")
      .attr("transform", (d) => `translate(${x(d.horiz)},${y(d.vert)})`);
    groups.append("circle")
      .attr("r", (d) => sizeScale(d.count))
      .attr("fill", (d) => PITCH_COLORS[d.pitch_type] ?? "#9ca3af")
      .attr("opacity", 0.7)
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 1);
    groups.append("text")
      .text((d) => d.pitch_type.replace("Four-Seam", "FF").replace("Two-Seam", "FT")
        .replace("Sinker", "SI").replace("Cutter", "FC")
        .replace("Slider", "SL").replace("Curveball", "CU")
        .replace("Changeup", "CH").replace("Splitter", "FS")
        .replace("Knuckleball", "KN"))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 10)
      .attr("font-weight", "bold")
      .attr("fill", "#fff")
      .attr("pointer-events", "none");
    groups.append("title").text((d) =>
      `${d.pitch_type} — n=${d.count}` +
      (d.avg_kph ? ` · ${d.avg_kph.toFixed(1)} kph` : "") +
      (d.spin ? ` · ${d.spin.toFixed(0)} rpm` : "") +
      `\nH break: ${d.horiz.toFixed(1)} cm · V break: ${d.vert.toFixed(1)} cm`,
    );

    // Axes
    g.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(8))
      .selectAll("text").attr("font-size", 10).attr("fill", "#475569");
    g.append("g").call(d3.axisLeft(y).ticks(8))
      .selectAll("text").attr("font-size", 10).attr("fill", "#475569");

    // Axis labels
    svg.append("text")
      .attr("x", width / 2).attr("y", height - 4)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#475569")
      .text("水平位移 (cm)  → 捕手右");
    svg.append("text")
      .attr("transform", `translate(12,${height / 2}) rotate(-90)`)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#475569")
      .text("垂直位移 (cm)  ↑ 上抬");
  }, [points, width, height]);

  return <svg ref={svgRef} width={width} height={height} />;
}
