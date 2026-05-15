"use client";

/**
 * Generic D3 histogram with optional reference lines (e.g. league average).
 */
import * as d3 from "d3";
import { useEffect, useRef } from "react";

interface Props {
  values: number[];
  /** Domain min/max; if omitted, computed from data. */
  domain?: [number, number];
  bins?: number;
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  color?: string;
  refLines?: Array<{ value: number; label: string; color?: string }>;
}

export function Histogram({
  values,
  domain,
  bins = 24,
  width = 360,
  height = 220,
  xLabel = "",
  yLabel = "球數",
  color = "#dc2626",
  refLines = [],
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const m = { top: 16, right: 16, bottom: 30, left: 36 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const g = svg
      .append("g")
      .attr("transform", `translate(${m.left},${m.top})`);

    const dom = domain ?? (d3.extent(values) as [number, number]);
    const x = d3.scaleLinear().domain(dom).nice().range([0, w]);
    const histo = d3
      .bin<number, number>()
      .domain(x.domain() as [number, number])
      .thresholds(x.ticks(bins));
    const bs = histo(values);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(bs, (b) => b.length) ?? 1])
      .nice()
      .range([h, 0]);

    g.append("g")
      .selectAll("rect")
      .data(bs)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.x0 ?? 0))
      .attr("y", (d) => y(d.length))
      .attr("width", (d) =>
        Math.max(1, x(d.x1 ?? 0) - x(d.x0 ?? 0) - 1),
      )
      .attr("height", (d) => h - y(d.length))
      .attr("fill", color)
      .attr("opacity", 0.85);

    for (const r of refLines) {
      const cx = x(r.value);
      g.append("line")
        .attr("x1", cx)
        .attr("x2", cx)
        .attr("y1", 0)
        .attr("y2", h)
        .attr("stroke", r.color ?? "#0f172a")
        .attr("stroke-width", 1.2)
        .attr("stroke-dasharray", "4,3");
      g.append("text")
        .attr("x", cx + 3)
        .attr("y", 10)
        .attr("font-size", 9)
        .attr("fill", r.color ?? "#0f172a")
        .text(r.label);
    }

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

    if (xLabel)
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height - 4)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("fill", "#475569")
        .text(xLabel);
    if (yLabel)
      svg
        .append("text")
        .attr("transform", `translate(10,${height / 2}) rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("fill", "#475569")
        .text(yLabel);
  }, [values, domain, bins, width, height, xLabel, yLabel, color, refLines]);

  return <svg ref={svgRef} width={width} height={height} />;
}
