"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useState } from "react";
import * as d3 from "d3";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PageHeader,
  FilterBar,
  SectionCard,
  DataTable,
  LoadingState,
  type Column,
} from "@/components/common";
import { fmtNum, fmtSigned } from "@/lib/format";

type PredictRow = {
  player_id: string; name: string; team_name: string;
  pa: number; woba: number; xwoba: number; delta: number;
  proj_woba: number;
};

const COLS: Column<PredictRow>[] = [
  {
    key: "name",
    label: "球員",
    render: (r) => (
      <Link href={`/players/${r.player_id}`} className="text-blue-700 font-medium hover:underline">
        {r.name}
      </Link>
    ),
  },
  { key: "team_name", label: "球隊", render: (r) => <span className="text-slate-800">{r.team_name}</span> },
  { key: "pa", label: "PA", fmt: "int", align: "right" },
  { key: "woba", label: "wOBA", fmt: "f3", align: "right" },
  { key: "xwoba", label: "xwOBA", fmt: "f3", align: "right" },
  {
    key: "delta",
    label: "Δ",
    align: "right",
    render: (r) => (
      <span className={r.delta > 0.04 ? "text-red-600" : r.delta < -0.04 ? "text-blue-600" : ""}>
        {fmtSigned(r.delta, 3)}
      </span>
    ),
  },
  { key: "proj_woba", label: "Proj wOBA", fmt: "f3", align: "right", cellClassName: "font-bold text-slate-900" },
];

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
      <PageHeader
        title="xwOBA 預測模型"
        subtitle="Ridge 回歸從球員 peripheral 指標推算「真實能力」xwOBA，並以 Bayesian 鎮重 100 PA 投影 wOBA。"
      />

      <FilterBar>
        <FilterBar.Field label="角色">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="batter">打者</SelectItem>
              <SelectItem value="pitcher">投手</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="分區">
          <Select value={division} onValueChange={setDivision}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="first">一軍</SelectItem>
              <SelectItem value="second">二軍</SelectItem>
              <SelectItem value="all">全部</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="最低 PA">
          <Select value={String(minPa)} onValueChange={(v) => setMinPa(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[20, 30, 50, 80, 100, 150].map((v) => (
                <SelectItem key={v} value={String(v)}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
      </FilterBar>

      {q.data ? (
        <>
          <SectionCard title="模型診斷">
            <div className="text-sm space-y-1">
              <div>訓練樣本：<b>{q.data.n_train}</b> 名球員（PA ≥ {minPa}）</div>
              <div>5-fold CV RMSE：<b>{fmtNum(q.data.rmse, 4)}</b></div>
            </div>
            <div className="mt-3 text-xs">
              <div className="text-slate-800 uppercase mb-1">特徵權重（per-unit, 原始 scale）</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">
                {Object.entries(q.data.coefs).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="tabular-nums font-semibold">{fmtNum(v, 4)}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="wOBA vs xwOBA 散佈圖"
            footer="對角線下方 = wOBA 低於預期（被低估，會回升）；對角線上方 = 過估（會回歸）。點大小 = PA。"
          >
            <Scatter rows={q.data.rows} />
          </SectionCard>

          <SectionCard title="投影 wOBA 排行 (Top 30)">
            <DataTable
              columns={COLS}
              rows={q.data.rows.slice(0, 30)}
              rowKey={(r) => r.player_id}
              showRank
            />
          </SectionCard>
        </>
      ) : (
        <LoadingState size="page" />
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

    g.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(8).tickSize(-h)).selectAll("line").attr("stroke", "#e5e7eb");
    g.append("g").call(d3.axisLeft(y).ticks(8).tickSize(-w)).selectAll("line").attr("stroke", "#e5e7eb");
    g.selectAll("path.domain").attr("stroke", "#94a3b8");

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

    const sorted = [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    g.selectAll("text.lbl").data(sorted.slice(0, 8)).enter().append("text")
      .attr("class", "lbl")
      .attr("x", (d) => x(d.xwoba) + 6)
      .attr("y", (d) => y(d.woba) + 4)
      .attr("font-size", 11).attr("fill", "#0f172a")
      .text((d) => d.name);

    svg.append("text").attr("x", W / 2).attr("y", H - 8)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#475569")
      .text("xwOBA (估計真實能力)");
    svg.append("text").attr("transform", `translate(14, ${H/2}) rotate(-90)`)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#475569")
      .text("wOBA (實際表現)");
  }, [rows]);
  return <svg ref={ref} width={720} height={520} />;
}
