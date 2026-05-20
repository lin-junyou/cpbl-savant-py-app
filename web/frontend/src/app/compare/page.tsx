"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PercentileBar } from "@/components/charts/PercentileBar";
import {
  PageHeader,
  SectionCard,
  EmptyState,
} from "@/components/common";
import { fmt, type FmtKind } from "@/lib/format";

const PR_ROWS: Array<[string, string]> = [
  ["woba_pr", "wOBA"],
  ["ba_pr", "BA"],
  ["obp_pr", "OBP"],
  ["slg_pr", "SLG"],
  ["iso_pr", "ISO"],
  ["exit_velo_avg_pr", "Avg EV"],
  ["exit_velo_max_pr", "Max EV"],
  ["hard_hit_pct_pr", "Hard Hit%"],
  ["barrel_pct_pr", "Barrel%"],
  ["k_pct_pr", "K%"],
  ["bb_pct_pr", "BB%"],
  ["whiff_pct_pr", "Whiff%"],
  ["chase_pct_pr", "Chase%"],
];

const SEASON_ROWS: Array<[string, string, FmtKind]> = [
  ["pa", "PA", "int"],
  ["woba", "wOBA", "f3"],
  ["ba", "BA", "f3"],
  ["obp", "OBP", "f3"],
  ["slg", "SLG", "f3"],
  ["iso", "ISO", "f3"],
  ["k_pct", "K%", "pct"],
  ["bb_pct", "BB%", "pct"],
  ["whiff_pct", "Whiff%", "pct"],
  ["hard_hit_pct", "HardHit%", "pct"],
  ["barrel_pct", "Barrel%", "pct"],
  ["exit_velo_avg", "EV avg", "f1"],
  ["exit_velo_max", "EV max", "f1"],
];

export default function ComparePage() {
  const search = useSearchParams();
  const router = useRouter();
  const idsParam = search.get("ids") ?? "";
  const ids = idsParam.split(",").filter(Boolean);

  const profiles = useQueries({
    queries: ids.map((pid) => ({
      queryKey: ["player", pid],
      queryFn: () => api.player(pid),
    })),
  });

  const [searchQ, setSearchQ] = useState("");
  const candidates = useQuery({
    queryKey: ["compare-search", searchQ],
    queryFn: () => api.players({ q: searchQ }),
    enabled: searchQ.trim().length > 0,
  });

  function addPlayer(pid: string) {
    const next = [...ids, pid].slice(0, 4);
    router.replace(`/compare?ids=${next.join(",")}`);
    setSearchQ("");
  }
  function removePlayer(pid: string) {
    const next = ids.filter((x) => x !== pid);
    router.replace(`/compare?ids=${next.join(",")}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="球員比較"
        subtitle="最多 4 位球員，PR 並列、雷達圖一目了然"
      />

      <SectionCard title="選擇球員（最多 4 位）">
        <div className="flex flex-wrap gap-2 mb-3">
          {profiles.map((q, i) => {
            const p = q.data?.bio;
            const pid = ids[i];
            return p ? (
              <span
                key={pid}
                className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1 text-sm"
              >
                <span className="font-semibold text-slate-900">{p.name as string}</span>
                <span className="text-xs text-slate-700">{p.team_name as string}</span>
                <button onClick={() => removePlayer(pid)} className="text-slate-500 hover:text-red-600">✕</button>
              </span>
            ) : null;
          })}
        </div>
        {ids.length < 4 && (
          <div className="relative">
            <Input
              placeholder="搜尋球員名字..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            {searchQ && candidates.data && (
              <div className="absolute top-full mt-1 left-0 right-0 max-h-72 overflow-y-auto bg-white border rounded-md shadow-lg z-10">
                {candidates.data.slice(0, 12).map((p) => (
                  <button
                    key={p.player_id}
                    onClick={() => addPlayer(p.player_id)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                  >
                    <span className="font-semibold text-slate-900">{p.name}</span>{" "}
                    <span className="text-slate-700 text-xs">
                      · {p.team_name} · {p.position_name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {ids.length > 0 && (
        <SectionCard title="百分位 PR 對比">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-700 border-b border-slate-300">
              <tr>
                <th className="text-left py-2 pr-2 font-semibold">指標</th>
                {profiles.map((q, i) => (
                  <th key={i} className="text-center py-2 px-2 font-semibold">
                    {(q.data?.bio.name as string) ?? ids[i]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PR_ROWS.map(([key, label]) => (
                <tr key={key} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 font-semibold text-slate-700">{label}</td>
                  {profiles.map((q, i) => {
                    const v = q.data?.pr?.[key];
                    return (
                      <td key={i} className="py-1.5 px-2">
                        {v != null ? <PercentileBar label="" pr={v} value="" /> : <span className="text-slate-700">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      {ids.length > 0 && (
        <SectionCard title="原始數值對比">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-700 border-b border-slate-300">
              <tr>
                <th className="text-left py-2 pr-2 font-semibold">指標</th>
                {profiles.map((q, i) => (
                  <th key={i} className="text-right py-2 px-2 font-semibold">
                    {(q.data?.bio.name as string) ?? ids[i]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SEASON_ROWS.map(([key, label, kind]) => (
                <tr key={key} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 font-semibold text-slate-700">{label}</td>
                  {profiles.map((q, i) => {
                    const v = q.data?.season?.[key] as number | null;
                    return (
                      <td key={i} className="py-1.5 px-2 text-right tabular-nums text-slate-900">
                        {fmt(v, kind)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      {ids.length === 0 && (
        <EmptyState
          size="page"
          text="尚未選擇任何球員"
          action={
            <Button asChild variant="outline">
              <a href="/compare?ids=0000006888,0000001318">看看範例</a>
            </Button>
          }
        />
      )}
    </div>
  );
}
