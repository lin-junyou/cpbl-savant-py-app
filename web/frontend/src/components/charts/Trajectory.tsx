"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { TrajectoryPitch } from "@/lib/api";
import { PITCH_COLORS } from "./StrikeZone";

interface Props {
  pitches: TrajectoryPitch[];
  view?: "side" | "top";
  width?: number;
  height?: number;
  highlightAcnt?: string | null;
}

/**
 * Trackman PolyFit coefficient convention (verified empirically against
 * PlateLocSide / PlateLocHeight / RelHeight / RelSide in the CPBL data):
 *
 *   X(t) = forward distance, m, from home plate.
 *          X(0) ≈ 16-17 m (release point); X(t_plate) = 0.
 *   Y(t) = vertical height, m. Y(0) ≈ release height; Y(t_plate) = PlateLocHeight.
 *   Z(t) = horizontal side, m. **Z is sign-flipped** vs PlateLocSide /
 *          RelSide — i.e. Z(t_plate) ≈ -PlateLocSide. We negate it for
 *          display so positive = catcher's right (Savant convention).
 *
 * Each polynomial is in standard order: poly[0] + poly[1]*t + poly[2]*t^2.
 */
function evalPoly(coef: [number, number, number], t: number): number {
  return coef[0] + coef[1] * t + coef[2] * t * t;
}

function plateTime(p: TrajectoryPitch): number {
  // Solve X(t) = 0 for the smallest positive root.
  if (!p.traj_x) return 0.45;
  const [c, b, a] = [p.traj_x[0], p.traj_x[1], p.traj_x[2]];
  const disc = b * b - 4 * a * c;
  if (disc < 0 || a === 0) return 0.45;
  const t1 = (-b - Math.sqrt(disc)) / (2 * a);
  const t2 = (-b + Math.sqrt(disc)) / (2 * a);
  const cands = [t1, t2].filter((t) => t > 0.01 && t < 1.5);
  return cands.length ? Math.min(...cands) : 0.45;
}

function pathOf(
  p: TrajectoryPitch,
  samples = 30,
): { dist: number; height: number; side: number }[] {
  if (!p.traj_x || !p.traj_y || !p.traj_z) return [];
  const tEnd = plateTime(p);
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = (tEnd * i) / samples;
    pts.push({
      dist: evalPoly(p.traj_x, t),
      height: evalPoly(p.traj_y, t),
      // Flip Z so positive = catcher's right (matches PlateLocSide).
      side: -evalPoly(p.traj_z, t),
    });
  }
  return pts;
}

export function Trajectory({
  pitches,
  view = "side",
  width = 480,
  height = 300,
  highlightAcnt = null,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const margin = { top: 20, right: 20, bottom: 36, left: 40 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    let xScale: d3.ScaleLinear<number, number>;
    let yScale: d3.ScaleLinear<number, number>;
    let xLabel: string;
    let yLabel: string;
    let project: (pt: { dist: number; height: number; side: number }) => [number, number];

    if (view === "side") {
      // Side view: distance on x-axis (release left → plate right),
      // height on y-axis.
      xScale = d3.scaleLinear().domain([18.5, -0.5]).range([0, w]);
      yScale = d3.scaleLinear().domain([0, 3.2]).range([h, 0]);
      xLabel = "← 投手   距離 (m)   本壘 →";
      yLabel = "高度 (m)";
      project = (pt) => [xScale(pt.dist), yScale(pt.height)];

      // Strike-zone band at the plate end
      g.append("rect")
        .attr("x", xScale(0))
        .attr("y", yScale(1.07))
        .attr("width", xScale(-0.5) - xScale(0))
        .attr("height", yScale(0.46) - yScale(1.07))
        .attr("fill", "rgba(220,38,38,0.08)")
        .attr("stroke", "#dc2626")
        .attr("stroke-width", 1);
      // Ground
      g.append("line")
        .attr("x1", 0)
        .attr("x2", w)
        .attr("y1", yScale(0))
        .attr("y2", yScale(0))
        .attr("stroke", "#9ca3af")
        .attr("stroke-width", 1);
      // Mound marker
      g.append("circle")
        .attr("cx", xScale(18.4))
        .attr("cy", yScale(0.25))
        .attr("r", 4)
        .attr("fill", "#a16207");
    } else {
      // Top view: catcher's view. Side on x-axis (positive = catcher's right),
      // distance on y-axis (plate at bottom, mound at top).
      xScale = d3.scaleLinear().domain([-1.2, 1.2]).range([0, w]);
      yScale = d3.scaleLinear().domain([0, 19]).range([h, 0]);
      xLabel = "側向 (m, + 捕手右)";
      yLabel = "距離 (m, 0 = 本壘)";
      project = (pt) => [xScale(pt.side), yScale(pt.dist)];

      // Pitcher mound + rubber
      g.append("rect")
        .attr("x", xScale(-0.3))
        .attr("y", yScale(18.6))
        .attr("width", xScale(0.3) - xScale(-0.3))
        .attr("height", yScale(18.2) - yScale(18.6))
        .attr("fill", "#a16207");
      // Home plate
      g.append("path")
        .attr(
          "d",
          `M${xScale(-0.215)},${yScale(0.1)} L${xScale(0.215)},${yScale(0.1)} L${xScale(0.15)},${yScale(0.05)} L${xScale(0)},${yScale(0)} L${xScale(-0.15)},${yScale(0.05)} Z`,
        )
        .attr("fill", "#fff")
        .attr("stroke", "#374151");
    }

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(xScale).ticks(6))
      .selectAll("text")
      .attr("font-size", 9)
      .attr("fill", "#6b7280");
    g.append("g")
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll("text")
      .attr("font-size", 9)
      .attr("fill", "#6b7280");
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 4)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#6b7280")
      .text(xLabel);
    svg
      .append("text")
      .attr("transform", `translate(12,${height / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#6b7280")
      .text(yLabel);

    const lineGen = d3.line<[number, number]>().x((d) => d[0]).y((d) => d[1]).curve(d3.curveBasis);

    pitches.forEach((p) => {
      const pts = pathOf(p);
      if (!pts.length) return;
      const projected = pts.map(project);
      const color = PITCH_COLORS[p.auto_pitch_type ?? ""] ?? "#9ca3af";
      const isHighlight = !highlightAcnt || p.pitcher_acnt === highlightAcnt;
      g.append("path")
        .attr("d", lineGen(projected) ?? "")
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", isHighlight ? 1.4 : 0.6)
        .attr("opacity", isHighlight ? 0.55 : 0.15)
        .append("title")
        .text(
          `${p.pitcher_name ?? "?"} → ${p.hitter_name ?? "?"}\n` +
            `${p.auto_pitch_type ?? "?"} ${p.rel_speed_kph?.toFixed(1)}kph ` +
            `${p.spin_rate?.toFixed(0)}rpm  (${p.pitch_call ?? "?"})`,
        );
      // End-point dot (plate crossing)
      const last = projected[projected.length - 1];
      g.append("circle")
        .attr("cx", last[0])
        .attr("cy", last[1])
        .attr("r", isHighlight ? 2.2 : 1.4)
        .attr("fill", color)
        .attr("opacity", isHighlight ? 0.7 : 0.25);
    });
  }, [pitches, view, width, height, highlightAcnt]);

  return <svg ref={svgRef} width={width} height={height} />;
}
