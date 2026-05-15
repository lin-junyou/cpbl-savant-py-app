"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { PitchLocation } from "@/lib/api";

interface Props {
  pitches: PitchLocation[];
  width?: number;
  height?: number;
  /**
   * "hexbin" => density heatmap. "scatter" => coloured by pitch type.
   */
  mode?: "hexbin" | "scatter";
  pitchTypeFilter?: string | null;
}

// Official MLB Baseball Savant pitch-type colours (from their player-page
// "Statcast Pitch Arsenal" inline list).
const PITCH_COLORS: Record<string, string> = {
  "Four-Seam":   "#D22D49",  // red
  "Two-Seam":    "#FE9D00",  // (alias of sinker)
  "Sinker":      "#FE9D00",  // orange
  "Cutter":      "#933F2C",  // brown
  "Slider":      "#C3BD0E",  // yellow-green
  "Sweeper":     "#DDB33A",  // gold
  "Curveball":   "#00D1ED",  // cyan
  "Changeup":    "#1DBE3F",  // green
  "Splitter":    "#3BACAC",  // teal (Split-Finger)
  "Knuckleball": "#6b7280",  // grey
  "Slurve":      "#9370DB",  // purple
  "Forkball":    "#3BACAC",
  "Screwball":   "#60279C",
};

export function StrikeZone({
  pitches,
  width = 360,
  height = 420,
  mode = "scatter",
  pitchTypeFilter = null,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 40, left: 36 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    // Savant-style: catcher's view (looking out toward the mound). Raw
    // PlateLocSide is in pitcher's view (positive = pitcher's right =
    // catcher's left). Flip the domain so positive renders on the right.
    const x = d3.scaleLinear().domain([1.0, -1.0]).range([0, w]);
    const y = d3.scaleLinear().domain([-0.2, 2.0]).range([h, 0]);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Strike zone box
    const zoneX = 0.215, zoneTop = 1.07, zoneBot = 0.46;
    g.append("rect")
      .attr("x", x(-zoneX))
      .attr("y", y(zoneTop))
      .attr("width", x(zoneX) - x(-zoneX))
      .attr("height", y(zoneBot) - y(zoneTop))
      .attr("fill", "none")
      .attr("stroke", "#374151")
      .attr("stroke-width", 1.5);

    // 9-zone grid lines
    const tx1 = -zoneX + (2 * zoneX) / 3;
    const tx2 = -zoneX + (4 * zoneX) / 3;
    const ty1 = zoneBot + (zoneTop - zoneBot) / 3;
    const ty2 = zoneBot + (2 * (zoneTop - zoneBot)) / 3;
    g.selectAll(".gridline")
      .data([
        { x1: tx1, x2: tx1, y1: zoneBot, y2: zoneTop },
        { x1: tx2, x2: tx2, y1: zoneBot, y2: zoneTop },
        { x1: -zoneX, x2: zoneX, y1: ty1, y2: ty1 },
        { x1: -zoneX, x2: zoneX, y1: ty2, y2: ty2 },
      ])
      .enter()
      .append("line")
      .attr("x1", (d) => x(d.x1))
      .attr("x2", (d) => x(d.x2))
      .attr("y1", (d) => y(d.y1))
      .attr("y2", (d) => y(d.y2))
      .attr("stroke", "#9ca3af")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "2,2");

    // Ground line
    g.append("line")
      .attr("x1", 0)
      .attr("x2", w)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#9ca3af")
      .attr("stroke-width", 1);

    // Home plate (just below ground in chart coord)
    g.append("path")
      .attr(
        "d",
        `M${x(-zoneX)},${y(-0.05)} L${x(zoneX)},${y(-0.05)} L${x(zoneX * 0.7)},${y(-0.1)} L${x(0)},${y(-0.15)} L${x(-zoneX * 0.7)},${y(-0.1)} Z`,
      )
      .attr("fill", "#fff")
      .attr("stroke", "#374151")
      .attr("stroke-width", 1);

    const data = pitches.filter(
      (p) =>
        p.plate_loc_side != null &&
        p.plate_loc_height != null &&
        (!pitchTypeFilter || p.auto_pitch_type === pitchTypeFilter),
    );

    if (mode === "hexbin") {
      // Simple density via 12x12 cells
      const cellW = w / 18;
      const cellH = h / 18;
      const cells = new Map<string, number>();
      for (const p of data) {
        const cx = Math.floor(x(p.plate_loc_side) / cellW);
        const cy = Math.floor(y(p.plate_loc_height) / cellH);
        const k = `${cx},${cy}`;
        cells.set(k, (cells.get(k) ?? 0) + 1);
      }
      const max = d3.max(Array.from(cells.values())) ?? 1;
      const color = d3.scaleSequential(d3.interpolateReds).domain([0, max]);
      for (const [k, v] of cells) {
        const [cx, cy] = k.split(",").map(Number);
        g.append("rect")
          .attr("x", cx * cellW)
          .attr("y", cy * cellH)
          .attr("width", cellW)
          .attr("height", cellH)
          .attr("fill", color(v))
          .attr("opacity", 0.85);
      }
    } else {
      g.selectAll(".pitch")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", (d) => x(d.plate_loc_side))
        .attr("cy", (d) => y(d.plate_loc_height))
        .attr("r", 3.5)
        .attr("fill", (d) => PITCH_COLORS[d.auto_pitch_type ?? ""] ?? "#9ca3af")
        .attr("opacity", 0.65)
        .attr("stroke", "#1f2937")
        .attr("stroke-width", 0.3);
    }

    // Axes (subtle)
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(5))
      .selectAll("text")
      .attr("font-size", 9)
      .attr("fill", "#6b7280");
    g.append("g")
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .attr("font-size", 9)
      .attr("fill", "#6b7280");
  }, [pitches, width, height, mode, pitchTypeFilter]);

  return <svg ref={svgRef} width={width} height={height} />;
}

export { PITCH_COLORS };
