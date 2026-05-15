"use client";

/**
 * Pitcher Arm Angle visualization — Savant style.
 *
 * Replicates the layout of the `#pitcher-arm-angle-bigger` SVG on
 * Baseball Savant's player page (Ohtani: 248.6 × 290 viewBox 120 × 140).
 *
 *   • Light grey panel background, 0.5px border.
 *   • Front-view pitcher silhouette (head + torso + legs).
 *   • Throwing arm extended at the inferred angle, with a baseball at
 *     the release point.
 *   • Big "All Years"-style year label above, slot label below.
 *
 * Angle is computed from the same physical formula Savant uses:
 *   ball_angle = atan2(release_height − shoulder_height, |release_side|)
 * Statcast convention: 0° = sidearm, ~90° = over-the-top.
 */
import * as d3 from "d3";
import { useEffect, useMemo, useRef } from "react";
import type { PitchLocation } from "@/lib/api";

interface Props {
  pitches: PitchLocation[];
  /** Body height in cm (from bio). Defaults to MLB-average ~ 188 cm. */
  bodyHeightCm: number;
  /** Throwing hand: "R" or "L" — used to mirror the arm. */
  throws?: string | null;
  /** Year label shown above the figure. */
  year?: string | number;
  width?: number;
  height?: number;
}

function slotLabel(deg: number): string {
  if (deg >= 60) return "Over-the-top 過頂";
  if (deg >= 45) return "High 3/4 高三分之一";
  if (deg >= 30) return "3/4 標準三分之一";
  if (deg >= 15) return "Low 3/4 低三分之一";
  if (deg >= -10) return "Sidearm 側投";
  return "Submarine 下勾";
}

export function ArmAngle({
  pitches,
  bodyHeightCm,
  throws,
  year,
  width = 248,
  height = 290,
}: Props) {
  const angles = useMemo(() => {
    const shoulderM = (bodyHeightCm / 100) * 0.82;
    const arr: number[] = [];
    for (const p of pitches) {
      if (p.rel_side == null || p.rel_height == null) continue;
      const dz = (p.rel_height as number) - shoulderM;
      const dy = Math.abs(p.rel_side as number);
      if (dy + Math.abs(dz) < 0.01) continue;
      arr.push(Math.atan2(dz, dy) * (180 / Math.PI));
    }
    return arr;
  }, [pitches, bodyHeightCm]);

  const avg = angles.length
    ? angles.reduce((s, x) => s + x, 0) / angles.length
    : 0;

  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    // Use the same viewBox proportions as Savant: 120 × 140.
    // Origin at top-left; y grows downward.
    const VB_W = 120;
    const VB_H = 140;
    svg.attr("viewBox", `0 0 ${VB_W} ${VB_H}`);
    svg.style("background", "#f9f9f9");
    svg.style("border", "0.5px solid #e1e1e1");

    // Year label (top centre, like Savant's "All Years")
    svg.append("text")
      .attr("x", VB_W / 2).attr("y", 12)
      .attr("text-anchor", "middle")
      .attr("font-size", 9)
      .attr("font-weight", 700)
      .attr("fill", "#0f172a")
      .text(year ? String(year) : "All Years");

    // Centre baseline of the figure
    const cx = VB_W / 2;
    const groundY = VB_H - 18;
    const headR = 7;
    const headCY = 28;
    const shoulderY = headCY + headR + 4;
    const hipY = shoulderY + 38;

    // Head
    svg.append("circle")
      .attr("cx", cx).attr("cy", headCY).attr("r", headR)
      .attr("fill", "#fde9d3").attr("stroke", "#0f172a").attr("stroke-width", 0.8);
    // Torso
    svg.append("line")
      .attr("x1", cx).attr("x2", cx)
      .attr("y1", shoulderY).attr("y2", hipY)
      .attr("stroke", "#0f172a").attr("stroke-width", 2.2);
    // Hips → legs
    svg.append("line").attr("x1", cx).attr("y1", hipY).attr("x2", cx - 10).attr("y2", groundY)
      .attr("stroke", "#0f172a").attr("stroke-width", 2.2).attr("stroke-linecap", "round");
    svg.append("line").attr("x1", cx).attr("y1", hipY).attr("x2", cx + 10).attr("y2", groundY)
      .attr("stroke", "#0f172a").attr("stroke-width", 2.2).attr("stroke-linecap", "round");
    // Ground
    svg.append("line")
      .attr("x1", 14).attr("x2", VB_W - 14)
      .attr("y1", groundY).attr("y2", groundY)
      .attr("stroke", "#94a3b8").attr("stroke-width", 0.6);

    // Reference angle gauge: arc from horizontal to vertical on the
    // throwing-arm side, marked at 0 / 30 / 60 / 90.
    const sign = throws === "L" ? -1 : 1;
    const armLen = 38;
    // 0° = horizontal sidearm, 90° = straight up overhead.
    // From the shoulder, sweep the arc.
    const gaugeR = armLen + 5;
    const arcGen = d3.arc()
      .innerRadius(gaugeR).outerRadius(gaugeR + 1)
      .startAngle(sign === 1 ? Math.PI / 2 : Math.PI)
      .endAngle(sign === 1 ? Math.PI : Math.PI / 2);
    svg.append("path")
      .attr("transform", `translate(${cx},${shoulderY}) scale(${sign},1)`)
      .attr("d", arcGen as never)
      .attr("fill", "#cbd5e1");
    [0, 30, 60, 90].forEach((g) => {
      const a = (g * Math.PI) / 180;
      const x = cx + sign * (gaugeR + 4) * Math.cos(a);
      const y = shoulderY - (gaugeR + 4) * Math.sin(a);
      svg.append("text")
        .attr("x", x).attr("y", y + 2)
        .attr("text-anchor", sign === 1 ? "start" : "end")
        .attr("font-size", 5)
        .attr("fill", "#475569")
        .text(g + "°");
    });

    // Glove arm (idle)
    const ga = (-15 * Math.PI) / 180;
    const gx = cx - sign * 26 * Math.cos(ga);
    const gy = shoulderY - 26 * Math.sin(ga);
    svg.append("line")
      .attr("x1", cx).attr("y1", shoulderY)
      .attr("x2", gx).attr("y2", gy)
      .attr("stroke", "#475569").attr("stroke-width", 2)
      .attr("stroke-linecap", "round").attr("opacity", 0.6);

    if (angles.length > 0) {
      const a = (avg * Math.PI) / 180;
      const armX = cx + sign * armLen * Math.cos(a);
      const armY = shoulderY - armLen * Math.sin(a);
      // Throwing arm
      svg.append("line")
        .attr("x1", cx).attr("y1", shoulderY)
        .attr("x2", armX).attr("y2", armY)
        .attr("stroke", "#dc2626").attr("stroke-width", 3.4).attr("stroke-linecap", "round");
      // Baseball at release point
      svg.append("circle")
        .attr("cx", armX).attr("cy", armY).attr("r", 3)
        .attr("fill", "#fff").attr("stroke", "#0f172a").attr("stroke-width", 0.8);
      // Mini stitches on the ball
      svg.append("path")
        .attr("d", `M${armX - 2.5},${armY} Q${armX},${armY - 2} ${armX + 2.5},${armY}`)
        .attr("fill", "none").attr("stroke", "#b91c1c").attr("stroke-width", 0.5);
      svg.append("path")
        .attr("d", `M${armX - 2.5},${armY} Q${armX},${armY + 2} ${armX + 2.5},${armY}`)
        .attr("fill", "none").attr("stroke", "#b91c1c").attr("stroke-width", 0.5);

      // Big angle text (lower-centre, Savant-style)
      svg.append("text")
        .attr("x", cx).attr("y", VB_H - 6)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .attr("font-weight", 800)
        .attr("fill", "#dc2626")
        .text(`${avg.toFixed(0)}°`);
    } else {
      svg.append("text")
        .attr("x", cx).attr("y", VB_H - 6)
        .attr("text-anchor", "middle")
        .attr("font-size", 8)
        .attr("fill", "#94a3b8")
        .text("（無資料）");
    }
  }, [angles, avg, throws, year, width, height]);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        ref={ref}
        width={width}
        height={height}
        style={{ display: "block" }}
      />
      {angles.length > 0 && (
        <div className="text-sm font-semibold text-slate-900">
          {slotLabel(avg)} <span className="text-slate-500">· n={angles.length}</span>
        </div>
      )}
    </div>
  );
}
