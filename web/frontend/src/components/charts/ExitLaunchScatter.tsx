"use client";

/**
 * Exit velocity (x) vs launch angle (y) scatter, with Statcast-style
 * "barrel" quality-of-contact zones overlaid as background.
 *
 * The barrel band requires both high exit velo (>= ~158 kph) and a launch
 * angle roughly in 24°-33°, widening as EV climbs. We shade the four
 * quality buckets: barrel (red), solid (orange), flares/burners (yellow),
 * weak/topped (grey).
 */
import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { ContactEvent } from "@/lib/api";

interface Props {
  events: ContactEvent[];
  width?: number;
  height?: number;
}

function outcomeColor(content: string | null | undefined): string {
  if (!content) return "#94a3b8";
  if (content.includes("全壘打")) return "#dc2626";
  if (content.includes("三壘安打")) return "#9333ea";
  if (content.includes("二壘安打")) return "#2563eb";
  if (content.includes("安打")) return "#16a34a";
  return "#cbd5e1";
}

export function ExitLaunchScatter({
  events,
  width = 420,
  height = 360,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const m = { top: 16, right: 16, bottom: 36, left: 40 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const x = d3.scaleLinear().domain([110, 200]).range([0, w]);
    const y = d3.scaleLinear().domain([-30, 65]).range([h, 0]);

    // Background "barrel" zone: roughly EV >= 158 kph (98 mph), LA 24-33°.
    g.append("rect")
      .attr("x", x(158)).attr("y", y(33))
      .attr("width", x(200) - x(158))
      .attr("height", y(24) - y(33))
      .attr("fill", "#fca5a5").attr("opacity", 0.45);
    // Solid contact ring: lower EV, similar LA
    g.append("rect")
      .attr("x", x(150)).attr("y", y(33))
      .attr("width", x(158) - x(150))
      .attr("height", y(24) - y(33))
      .attr("fill", "#fdba74").attr("opacity", 0.4);
    // Sweet spot launch-angle band (8-32° regardless of EV)
    g.append("rect")
      .attr("x", 0).attr("y", y(32))
      .attr("width", w)
      .attr("height", y(8) - y(32))
      .attr("fill", "#fef3c7").attr("opacity", 0.25);

    // Grid
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(-h))
      .selectAll("line").attr("stroke", "#e5e7eb");
    g.append("g")
      .call(d3.axisLeft(y).ticks(6).tickSize(-w))
      .selectAll("line").attr("stroke", "#e5e7eb");
    g.selectAll("path.domain").attr("stroke", "transparent");

    // 0° launch angle reference
    g.append("line")
      .attr("x1", 0).attr("x2", w)
      .attr("y1", y(0)).attr("y2", y(0))
      .attr("stroke", "#475569").attr("stroke-dasharray", "3,3");

    g.selectAll(".bb")
      .data(events.filter((e) => e.hit_exit_speed_kph != null && e.hit_launch_angle != null))
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.hit_exit_speed_kph!))
      .attr("cy", (d) => y(d.hit_launch_angle!))
      .attr("r", 4)
      .attr("fill", (d) => outcomeColor(d.content))
      .attr("opacity", 0.75)
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 0.4)
      .append("title")
      .text((d) =>
        `${d.batting_action ?? "?"} · ${d.content?.slice(0, 28) ?? ""}\n` +
        `EV ${d.hit_exit_speed_kph?.toFixed(1)} kph · LA ${d.hit_launch_angle?.toFixed(1)}°\n` +
        (d.land_distance_m ? `飛行距離 ${d.land_distance_m.toFixed(0)} m` : ""),
      );

    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(6))
      .selectAll("text").attr("font-size", 9).attr("fill", "#374151");
    g.append("g")
      .call(d3.axisLeft(y).ticks(6))
      .selectAll("text").attr("font-size", 9).attr("fill", "#374151");

    svg.append("text")
      .attr("x", width / 2).attr("y", height - 4)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#475569")
      .text("擊球初速 (kph)");
    svg.append("text")
      .attr("transform", `translate(10,${height / 2}) rotate(-90)`)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#475569")
      .text("發射仰角 (°)");
  }, [events, width, height]);

  return <svg ref={svgRef} width={width} height={height} />;
}
