"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { SprayPoint } from "@/lib/api";

interface Props {
  data: SprayPoint[];
  width?: number;
  height?: number;
  fenceL?: number;
  fenceC?: number;
  fenceR?: number;
}

const OUTCOME_COLOR = (content: string | null): string => {
  if (!content) return "#9ca3af";
  if (content.includes("全壘打")) return "#dc2626";
  if (content.includes("三壘安打")) return "#9333ea";
  if (content.includes("二壘安打")) return "#2563eb";
  if (content.includes("安打")) return "#16a34a";
  if (content.includes("失誤")) return "#f59e0b";
  if (content.includes("出局") || content.includes("刺殺") || content.includes("接殺"))
    return "#cbd5e1";
  return "#9ca3af";
};

const OUTCOME_LABEL = (content: string | null): string => {
  if (!content) return "其他";
  if (content.includes("全壘打")) return "HR";
  if (content.includes("三壘安打")) return "3B";
  if (content.includes("二壘安打")) return "2B";
  if (content.includes("安打")) return "1B";
  if (content.includes("失誤")) return "失誤";
  if (content.includes("出局") || content.includes("刺殺") || content.includes("接殺"))
    return "出局";
  return "其他";
};

export function SprayChart({
  data,
  width = 480,
  height = 460,
  fenceL = 99,
  fenceC = 122,
  fenceR = 99,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 30 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const xMax = 130;
    const x = d3.scaleLinear().domain([-xMax, xMax]).range([0, w]);
    const y = d3.scaleLinear().domain([-15, 145]).range([h, 0]);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Foul lines
    const r45 = Math.PI / 4;
    g.append("line")
      .attr("x1", x(0))
      .attr("y1", y(0))
      .attr("x2", x(-fenceL * Math.sin(r45)))
      .attr("y2", y(fenceL * Math.cos(r45)))
      .attr("stroke", "#000")
      .attr("stroke-width", 1);
    g.append("line")
      .attr("x1", x(0))
      .attr("y1", y(0))
      .attr("x2", x(fenceR * Math.sin(r45)))
      .attr("y2", y(fenceR * Math.cos(r45)))
      .attr("stroke", "#000")
      .attr("stroke-width", 1);

    // Outfield fence (interpolated radius)
    const fence = d3.range(-45, 46, 2).map((deg) => {
      const a = (deg * Math.PI) / 180;
      const r =
        deg < 0
          ? fenceL + ((fenceC - fenceL) * (deg + 45)) / 45
          : fenceC + ((fenceR - fenceC) * deg) / 45;
      return [x(r * Math.sin(a)), y(r * Math.cos(a))] as [number, number];
    });
    g.append("path")
      .datum(fence)
      .attr("d", d3.line())
      .attr("fill", "none")
      .attr("stroke", "#15803d")
      .attr("stroke-width", 2);

    // Infield diamond
    const base = 27.4;
    const diamond = [
      [x(0), y(0)],
      [x(base / Math.sqrt(2)), y(base / Math.sqrt(2))],
      [x(0), y(base * Math.sqrt(2))],
      [x(-base / Math.sqrt(2)), y(base / Math.sqrt(2))],
      [x(0), y(0)],
    ] as [number, number][];
    g.append("path")
      .datum(diamond)
      .attr("d", d3.line())
      .attr("fill", "rgba(180,140,80,0.15)")
      .attr("stroke", "#a16207")
      .attr("stroke-width", 1);

    // Mound
    g.append("circle")
      .attr("cx", x(0))
      .attr("cy", y(18.4))
      .attr("r", 3)
      .attr("fill", "#a16207");

    // Batted ball points
    const valid = data.filter(
      (d) => d.land_bearing != null && d.land_distance_m != null,
    );
    g.selectAll(".bb")
      .data(valid)
      .enter()
      .append("circle")
      .attr("cx", (d) => {
        const a = (d.land_bearing! * Math.PI) / 180;
        return x(d.land_distance_m! * Math.sin(a));
      })
      .attr("cy", (d) => {
        const a = (d.land_bearing! * Math.PI) / 180;
        return y(d.land_distance_m! * Math.cos(a));
      })
      .attr("r", (d) =>
        d.hit_exit_speed_kph
          ? Math.max(2, (d.hit_exit_speed_kph - 80) / 18)
          : 3,
      )
      .attr("fill", (d) => OUTCOME_COLOR(d.content))
      .attr("opacity", 0.7)
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 0.3)
      .append("title")
      .text(
        (d) =>
          `${d.hitter_name ?? "?"} → ${OUTCOME_LABEL(d.content)}\n` +
          `${d.land_distance_m?.toFixed(0)}m, ${d.hit_exit_speed_kph?.toFixed(0)}kph, LA ${d.hit_launch_angle?.toFixed(0)}°`,
      );

    // Legend
    const legendItems = [
      ["HR", "#dc2626"],
      ["3B", "#9333ea"],
      ["2B", "#2563eb"],
      ["1B", "#16a34a"],
      ["失誤", "#f59e0b"],
      ["出局", "#cbd5e1"],
    ];
    const legend = g.append("g").attr("transform", `translate(8, 8)`);
    legend
      .selectAll(".lg")
      .data(legendItems)
      .enter()
      .append("g")
      .attr("transform", (_, i) => `translate(0, ${i * 16})`)
      .call((sel) => {
        sel
          .append("circle")
          .attr("r", 5)
          .attr("fill", (d) => d[1] as string);
        sel
          .append("text")
          .attr("x", 10)
          .attr("y", 4)
          .attr("font-size", 11)
          .attr("fill", "#374151")
          .text((d) => d[0] as string);
      });
  }, [data, width, height, fenceL, fenceC, fenceR]);

  return <svg ref={svgRef} width={width} height={height} />;
}
