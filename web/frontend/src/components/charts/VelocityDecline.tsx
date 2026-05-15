"use client";

/**
 * Within-game velocity decline chart for a pitcher.
 *
 *   X axis = pitch count within the game.
 *   Y axis = release speed (kph).
 *   Each game = one line + dots; selected pitch type only.
 */
import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";

interface Pitch {
  pitch_cnt: number;
  kph: number;
  pitch_type: string | null;
}
interface Game {
  game_id: string;
  date: string;
  pitches: Pitch[];
}

interface Props {
  games: Game[];
  width?: number;
  height?: number;
}

export function VelocityDecline({ games, width = 720, height = 320 }: Props) {
  const allTypes = Array.from(new Set(games.flatMap((g) =>
    g.pitches.map((p) => p.pitch_type ?? "—"),
  )));
  const [type, setType] = useState<string>("Four-Seam");
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const m = { top: 16, right: 16, bottom: 36, left: 40 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    // Filter to type & each game
    const filtered = games
      .map((g) => ({
        ...g,
        pitches: g.pitches.filter((p) => p.pitch_type === type),
      }))
      .filter((g) => g.pitches.length > 1);
    if (!filtered.length) {
      g.append("text").attr("x", w / 2).attr("y", h / 2)
        .attr("text-anchor", "middle").attr("fill", "#94a3b8")
        .text(`沒有 ${type} 的資料`);
      return;
    }
    const allPitches = filtered.flatMap((g) => g.pitches);
    const maxCnt = d3.max(allPitches, (p) => p.pitch_cnt) ?? 100;
    const yExt = d3.extent(allPitches, (p) => p.kph) as [number, number];
    const x = d3.scaleLinear().domain([1, maxCnt]).range([0, w]);
    const y = d3.scaleLinear()
      .domain([Math.floor(yExt[0]) - 2, Math.ceil(yExt[1]) + 2])
      .range([h, 0]);

    g.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(10).tickSize(-h))
      .selectAll("line").attr("stroke", "#e5e7eb");
    g.append("g").call(d3.axisLeft(y).ticks(6).tickSize(-w))
      .selectAll("line").attr("stroke", "#e5e7eb");
    g.selectAll("path.domain").attr("stroke", "#94a3b8");

    const colors = d3.schemeTableau10;
    const line = d3.line<Pitch>().x((p) => x(p.pitch_cnt)).y((p) => y(p.kph));

    filtered.forEach((gm, i) => {
      g.append("path").datum(gm.pitches)
        .attr("fill", "none").attr("stroke", colors[i % colors.length])
        .attr("stroke-width", 1.4).attr("opacity", 0.7).attr("d", line);
      g.selectAll(`.dot-${i}`).data(gm.pitches).enter().append("circle")
        .attr("cx", (p) => x(p.pitch_cnt)).attr("cy", (p) => y(p.kph))
        .attr("r", 2.5).attr("fill", colors[i % colors.length])
        .attr("opacity", 0.6)
        .append("title").text((p) => `${gm.date} pitch #${p.pitch_cnt}: ${p.kph.toFixed(1)} kph`);
    });

    // Linear regression line of all points → fatigue trend
    const xs = allPitches.map((p) => p.pitch_cnt);
    const ys = allPitches.map((p) => p.kph);
    const xMean = d3.mean(xs) ?? 0;
    const yMean = d3.mean(ys) ?? 0;
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - xMean) * (ys[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    const slope = num / (den || 1);
    const intercept = yMean - slope * xMean;
    g.append("line")
      .attr("x1", x(1)).attr("y1", y(intercept + slope * 1))
      .attr("x2", x(maxCnt)).attr("y2", y(intercept + slope * maxCnt))
      .attr("stroke", "#0f172a").attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,4");

    // Axis labels
    svg.append("text").attr("x", width / 2).attr("y", height - 8)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#475569")
      .text(`場內第 N 球（同色 = 同一場比賽）　趨勢斜率 ${slope.toFixed(3)} kph/球`);
    svg.append("text").attr("transform", `translate(12,${height/2}) rotate(-90)`)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#475569")
      .text("球速 (kph)");
  }, [games, type, width, height]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 text-xs">
        {allTypes.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-2 py-1 rounded border ${
              type === t
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <svg ref={ref} width={width} height={height} />
    </div>
  );
}
