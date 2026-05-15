"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function PredictPage() {
  const [role, setRole] = useState("batter");
  const [division, setDivision] = useState("first");
  const [minPa, setMinPa] = useState(50);

  const q = useQuery({
    queryKey: ["predict-xwoba", role, division, minPa],
    queryFn: () => api.predictXwoba({ role, division, min_pa: minPa }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">xwOBA 預測模型</h1>
        <p className="text-sm text-slate-700 mt-1">
          Ridge 回歸從球員 peripheral 指標（BB%、K%、Whiff%、Chase%、HardHit%、Barrel%、EV avg/max）
          推算「真實能力」xwOBA，再用 Bayesian 鎮重 100 PA 投影 wOBA。
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-700 mb-1">角色</label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="batter">打者</SelectItem>
              <SelectItem value="pitcher">投手</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs text-slate-700 mb-1">分區</label>
          <Select value={division} onValueChange={setDivision}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="first">一軍</SelectItem>
              <SelectItem value="second">二軍</SelectItem>
              <SelectItem value="all">全部</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs text-slate-700 mb-1">最低 PA</label>
          <Select value={String(minPa)} onValueChange={(v) => setMinPa(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[20, 30, 50, 80, 100, 150].map((v) => (
                <SelectItem key={v} value={String(v)}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {q.data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">
                模型診斷
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                <div>訓練樣本：<b>{q.data.n_train}</b> 名球員（PA ≥ {minPa}）</div>
                <div>5-fold CV RMSE：<b>{q.data.rmse?.toFixed(4) ?? "—"}</b></div>
              </div>
              <div className="mt-3 text-xs">
                <div className="text-slate-700 uppercase mb-1">特徵權重（per-unit, 原始 scale）</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">
                  {Object.entries(q.data.coefs).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span className="tabular-nums font-semibold">{v.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">
                wOBA vs xwOBA 散佈圖
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Scatter rows={q.data.rows} />
              <p className="mt-3 text-xs text-slate-700">
                對角線下方 = wOBA 低於預期（被低估，會回升）；對角線上方 = 過估（會回歸）。
                點大小 = PA。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">
                投影 wOBA 排行 (Top 30)
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-700 border-b">
                  <tr>
                    <th className="text-left py-2">#</th>
                    <th className="text-left py-2">球員</th>
                    <th className="text-left py-2">球隊</th>
                    <th className="text-right py-2">PA</th>
                    <th className="text-right py-2">wOBA</th>
                    <th className="text-right py-2">xwOBA</th>
                    <th className="text-right py-2">Δ</th>
                    <th className="text-right py-2">Proj wOBA</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.rows.slice(0, 30).map((r, i) => (
                    <tr key={r.player_id} className="border-b">
                      <td className="py-1.5 text-slate-700">{i + 1}</td>
                      <td className="py-1.5">
                        <Link
                          href={`/players/${r.player_id}`}
                          className="text-blue-700 font-medium hover:underline"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-1.5 text-slate-700">{r.team_name}</td>
                      <td className="py-1.5 text-right tabular-nums">{r.pa}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {r.woba.toFixed(3)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {r.xwoba.toFixed(3)}
                      </td>
                      <td className={`py-1.5 text-right tabular-nums ${r.delta > 0.04 ? "text-red-600" : r.delta < -0.04 ? "text-blue-600" : ""}`}>
                        {r.delta > 0 ? "+" : ""}{r.delta.toFixed(3)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums font-bold text-slate-900">
                        {r.proj_woba.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-slate-700 py-12 text-center">載入中...</div>
      )}
    </div>
  );
}

function Scatter({ rows }: { rows: Array<{ name: string; pa: number; woba: number; xwoba: number; delta: number }> }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const W = 720, H = 520;
    const m = { top: 16, right: 16, bottom: 50, left: 60 };
    const w = W - m.left - m.right;
    const h = H - m.top - m.bottom;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    if (rows.length === 0) return;
    const xExt = d3.extent(rows, (d) => d.xwoba) as [number, number];
    const yExt = d3.extent(rows, (d) => d.woba) as [number, number];
    const lo = Math.min(xExt[0], yExt[0]) - 0.02;
    const hi = Math.max(xExt[1], yExt[1]) + 0.02;
    const x = d3.scaleLinear().domain([lo, hi]).range([0, w]);
    const y = d3.scaleLinear().domain([lo, hi]).range([h, 0]);
    const r = d3.scaleSqrt().domain([0, d3.max(rows, (d) => d.pa) ?? 1]).range([3, 12]);
    const c = d3.scaleDiverging<string>().domain([-0.08, 0, 0.08]).interpolator(d3.interpolateRdBu);

    // grid
    g.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(8).tickSize(-h)).selectAll("line").attr("stroke", "#e5e7eb");
    g.append("g").call(d3.axisLeft(y).ticks(8).tickSize(-w)).selectAll("line").attr("stroke", "#e5e7eb");
    g.selectAll("path.domain").attr("stroke", "#94a3b8");

    // diagonal
    g.append("line")
      .attr("x1", x(lo)).attr("y1", y(lo))
      .attr("x2", x(hi)).attr("y2", y(hi))
      .attr("stroke", "#475569").attr("stroke-dasharray", "4,3");

    g.selectAll("circle").data(rows).enter().append("circle")
      .attr("cx", (d) => x(d.xwoba))
      .attr("cy", (d) => y(d.woba))
      .attr("r", (d) => r(d.pa))
      .attr("fill", (d) => c(-d.delta) || "#94a3b8")
      .attr("opacity", 0.7)
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 0.4)
      .append("title")
      .text((d) => `${d.name}\nPA ${d.pa}\nwOBA ${d.woba.toFixed(3)}\nxwOBA ${d.xwoba.toFixed(3)}\nΔ ${(d.delta>0?"+":"")+d.delta.toFixed(3)}`);

    // Labels for top 5 over/underperformers
    const sorted = [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    g.selectAll("text.lbl").data(sorted.slice(0, 8)).enter().append("text")
      .attr("class", "lbl")
      .attr("x", (d) => x(d.xwoba) + 6)
      .attr("y", (d) => y(d.woba) + 4)
      .attr("font-size", 11).attr("fill", "#0f172a")
      .text((d) => d.name);

    // Axis labels
    svg.append("text").attr("x", W / 2).attr("y", H - 8)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#475569")
      .text("xwOBA (估計真實能力)");
    svg.append("text").attr("transform", `translate(14, ${H/2}) rotate(-90)`)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#475569")
      .text("wOBA (實際表現)");
  }, [rows]);
  return <svg ref={ref} width={720} height={520} />;
}
