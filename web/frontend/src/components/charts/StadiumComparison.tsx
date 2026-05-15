"use client";

/**
 * Cross-stadium comparison: small-multiples bar chart of selected metric
 * across all stadiums, sorted descending.
 */
import { useState } from "react";
import Link from "next/link";

interface Row {
  field_name: string;
  pitches: number;
  hr: number;
  hr_per_1000: number;
  hits_per_1000: number;
  avg_ev: number | null;
  avg_la: number | null;
  avg_dist: number | null;
  max_dist: number;
}

const METRICS: Array<[keyof Row | string, string, string]> = [
  ["hr_per_1000", "全壘打 / 1000 球", "#dc2626"],
  ["hits_per_1000", "安打 / 1000 球", "#16a34a"],
  ["avg_ev", "平均 Exit Velo (kph)", "#f97316"],
  ["avg_dist", "平均飛行距離 (m)", "#2563eb"],
  ["max_dist", "最遠飛行距離 (m)", "#9333ea"],
];

export function StadiumComparison({ rows }: { rows: Row[] }) {
  const [metric, setMetric] = useState<string>("hr_per_1000");
  const sorted = [...rows]
    .filter((r) => r[metric as keyof Row] != null)
    .sort(
      (a, b) =>
        ((b[metric as keyof Row] as number) ?? 0) -
        ((a[metric as keyof Row] as number) ?? 0),
    );
  const max = Math.max(
    ...sorted.map((r) => Math.abs((r[metric as keyof Row] as number) ?? 0)),
    1,
  );
  const color = METRICS.find(([k]) => k === metric)?.[2] ?? "#dc2626";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {METRICS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setMetric(k as string)}
            className={`px-2 py-1 rounded border ${
              metric === k
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {sorted.map((r) => {
          const v = (r[metric as keyof Row] as number) ?? 0;
          const widthPct = (Math.abs(v) / max) * 100;
          return (
            <Link
              key={r.field_name}
              href={`/stadiums/${encodeURIComponent(r.field_name)}`}
              className="block hover:bg-slate-50"
            >
              <div className="grid grid-cols-[110px_1fr_70px] items-center gap-2 text-sm py-0.5">
                <span className="text-right pr-2 text-slate-700 font-medium">
                  {r.field_name}
                </span>
                <div className="relative h-5 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 rounded"
                    style={{ background: color, width: `${widthPct}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-semibold tabular-nums text-slate-900">
                    {typeof v === "number" ? v.toFixed(1) : v}
                  </span>
                </div>
                <span className="text-xs text-slate-500 tabular-nums">
                  {r.pitches.toLocaleString()} 球
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
