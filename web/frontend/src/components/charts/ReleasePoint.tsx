"use client";

/**
 * Release-point chart: 2D scatter of where the ball leaves the pitcher's
 * hand. X = horizontal release side (m, from pitcher's POV → flipped to
 * catcher view), Y = vertical release height (m). Dots are coloured by
 * pitch type and sized by frequency.
 */
import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { PitchLocation } from "@/lib/api";
import { PITCH_COLORS } from "./StrikeZone";

interface Props {
  pitches: PitchLocation[];
  width?: number;
  height?: number;
}

export function ReleasePoint({ pitches, width = 360, height = 360 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const m = { top: 16, right: 16, bottom: 36, left: 40 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const g = svg
      .append("g")
      .attr("transform", `translate(${m.left},${m.top})`);

    const data = pitches.filter(
      (p) => p.rel_side != null && p.rel_height != null,
    );
    if (!data.length) return;

    // Flip rel_side to catcher view
    const xs = data.map((d) => -(d.rel_side as number));
    const ys = data.map((d) => d.rel_height as number);
    const xMin = (d3.min(xs) ?? -1) - 0.3;
    const xMax = (d3.max(xs) ?? 1) + 0.3;
    const yMin = Math.max(0, (d3.min(ys) ?? 0) - 0.3);
    const yMax = (d3.max(ys) ?? 2) + 0.3;

    const x = d3.scaleLinear().domain([xMin, xMax]).range([0, w]);
    const y = d3.scaleLinear().domain([yMin, yMax]).range([h, 0]);

    // Background mound silhouette (subtle)
    g.append("rect")
      .attr("x", 0)
      .attr("y", y(0))
      .attr("width", w)
      .attr("height", h - y(0))
      .attr("fill", "#f1f5f9");

    // Pitching rubber line at y=0
    g.append("line")
      .attr("x1", 0)
      .attr("x2", w)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#94a3b8");

    // Grid lines only — tickFormat("") suppresses tick labels so the
    // labelled axes drawn below don't render text twice.
    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(-h).tickFormat(() => ""))
      .call((s) => s.selectAll("line").attr("stroke", "#e5e7eb"))
      .call((s) => s.select("path.domain").remove());
    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(() => ""))
      .call((s) => s.selectAll("line").attr("stroke", "#e5e7eb"))
      .call((s) => s.select("path.domain").remove());

    g.selectAll(".rel")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(-(d.rel_side as number)))
      .attr("cy", (d) => y(d.rel_height as number))
      .attr("r", 3.5)
      .attr("fill", (d) => PITCH_COLORS[d.auto_pitch_type ?? ""] ?? "#9ca3af")
      .attr("opacity", 0.55)
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 0.3)
      .append("title")
      .text(
        (d) =>
          `${d.auto_pitch_type ?? "?"}\nRelHeight ${d.rel_height?.toFixed(2)}m, RelSide ${d.rel_side?.toFixed(2)}m`,
      );

    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(6))
      .selectAll("text")
      .attr("font-size", 9)
      .attr("fill", "#374151");
    g.append("g")
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .attr("font-size", 9)
      .attr("fill", "#374151");

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 4)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#475569")
      .text("水平 (m, + 捕手右)");
    svg
      .append("text")
      .attr("transform", `translate(10,${height / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#475569")
      .text("釋球高度 (m)");
  }, [pitches, width, height]);

  return <svg ref={svgRef} width={width} height={height} />;
}
