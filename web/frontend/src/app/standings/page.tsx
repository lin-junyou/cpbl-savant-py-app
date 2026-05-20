"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  PageHeader,
  SectionCard,
  DataTable,
  LoadingState,
  type Column,
} from "@/components/common";
import { fmtSigned } from "@/lib/format";

type StandingRow = {
  team: string;
  w: number; l: number; t: number;
  pct: number; rs: number; ra: number; diff: number;
  pyth: number; last10: string; gp: number; gb: number;
};

const COLS: Column<StandingRow>[] = [
  { key: "team", label: "球隊", render: (r) => <span className="font-bold text-slate-900">{r.team}</span> },
  { key: "w", label: "W", fmt: "int", align: "right", cellClassName: "font-semibold" },
  { key: "l", label: "L", fmt: "int", align: "right" },
  { key: "t", label: "T", fmt: "int", align: "right" },
  { key: "pct", label: "勝率", fmt: "f3", align: "right", cellClassName: "font-bold" },
  {
    key: "gb",
    label: "GB",
    align: "right",
    render: (r) => (r.gb === 0 ? "—" : r.gb.toFixed(1)),
  },
  { key: "rs", label: "RS", fmt: "int", align: "right" },
  { key: "ra", label: "RA", fmt: "int", align: "right" },
  {
    key: "diff",
    label: "±",
    align: "right",
    render: (r) => (
      <span className={r.diff > 0 ? "text-red-600" : r.diff < 0 ? "text-blue-600" : ""}>
        {fmtSigned(r.diff)}
      </span>
    ),
  },
  { key: "pyth", label: "Pyth%", fmt: "f3", align: "right", cellClassName: "text-slate-700" },
  { key: "last10", label: "最近 10", align: "right" },
];

export default function StandingsPage() {
  const [kind, setKind] = useState("A");
  const q = useQuery({
    queryKey: ["standings", 2026, kind],
    queryFn: () => api.standings(2026, kind),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="2026 戰績榜"
        subtitle={kind === "A" ? "一軍" : "二軍"}
        actions={
          <div className="flex gap-2 text-sm">
            {[["A", "一軍"], ["D", "二軍"]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-3 py-1.5 rounded border ${
                  kind === k
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      <SectionCard
        title={`${kind === "A" ? "一軍" : "二軍"} 戰績`}
        footer={
          <>
            <b>Pyth%</b> = Pythagorean expected winning percentage = RS¹·⁸³ /
            (RS¹·⁸³ + RA¹·⁸³)。高於實際勝率代表「該勝沒勝」(運氣不佳)，反之亦然。
          </>
        }
      >
        {q.isLoading ? (
          <LoadingState />
        ) : q.data ? (
          <DataTable columns={COLS} rows={q.data} rowKey={(r) => r.team} showRank />
        ) : null}
      </SectionCard>
    </div>
  );
}
