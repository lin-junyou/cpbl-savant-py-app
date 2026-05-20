"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  PageHeader,
  SectionCard,
  StatGrid,
  DataTable,
  Section,
  type Column,
} from "@/components/common";
import { fmt, fmtPct } from "@/lib/format";

type LeaderRow = Record<string, unknown> & {
  player_id?: string;
  player_name?: string;
  team_name?: string;
};

const TOP_BATTER_COLS: Column<LeaderRow>[] = [
  {
    key: "player_name",
    label: "球員",
    render: (r) => (
      <Link href={`/players/${r.player_id}`} className="font-medium hover:underline text-slate-900">
        {r.player_name as string}
      </Link>
    ),
  },
  { key: "team_name", label: "球隊", render: (r) => <span className="text-slate-700">{r.team_name as string}</span> },
  { key: "pa", label: "PA", fmt: "int", align: "right" },
  { key: "woba", label: "wOBA", fmt: "f3", align: "right", cellClassName: "font-semibold" },
];

const TOP_PITCHER_COLS: Column<LeaderRow>[] = [
  ...TOP_BATTER_COLS.slice(0, 3),
  {
    key: "whiffp",
    label: "Whiff%",
    align: "right",
    cellClassName: "font-semibold",
    render: (r) => fmtPct(r.whiffp as number),
  },
];

export default function HomePage() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  const stadiums = useQuery({ queryKey: ["stadiums"], queryFn: api.stadiums });
  const teams = useQuery({ queryKey: ["teams"], queryFn: api.teams });
  const topBatters = useQuery({
    queryKey: ["top", "batter", "woba"],
    queryFn: () => api.leaderboard("pr-batter", { sort_by: "woba", min_pa: 80, limit: 30 }),
  });
  const topPitchers = useQuery({
    queryKey: ["top", "pitcher", "whiffp"],
    queryFn: () => api.leaderboard("pr-pitcher", { sort_by: "whiffp", min_pa: 50, limit: 30 }),
  });
  const leagueLeaders = useQuery({ queryKey: ["league-leaders"], queryFn: api.leagueLeaders });

  const totalPitches = stadiums.data?.reduce((s, x) => s + x.pitches, 0) ?? null;

  const filterFirst = (rows: LeaderRow[] | undefined) =>
    (rows ?? []).filter((r) => !(r.team_name as string)?.includes("二軍")).slice(0, 10);

  return (
    <div className="space-y-8">
      <PageHeader
        size="lg"
        title="CPBL Savant"
        subtitle={
          <>
            中華職棒 2026 球季 Statcast 風格進階數據分析。
            資料庫共 {health.data?.players ?? "—"} 位球員、
            {totalPitches != null ? totalPitches.toLocaleString() : "—"} 個 Trackman 球路。
          </>
        }
      />

      <StatGrid
        cols={{ base: 1, sm: 3 }}
        items={[
          {
            label: "球場",
            value: stadiums.data?.length,
            fmt: "int",
            hint: "已記錄 Trackman 資料的球場",
            tone: "red",
          },
          {
            label: "球隊",
            value: teams.data?.length,
            fmt: "int",
            hint: "一/二軍合計",
            tone: "blue",
          },
          {
            label: "球員",
            value: health.data?.players,
            fmt: "int",
            hint: "含詳細進階數據",
            tone: "green",
          },
        ]}
      />

      <Section title="本季領先者">
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="一軍打者 wOBA TOP 10（PA≥80）">
            <DataTable
              columns={TOP_BATTER_COLS}
              rows={filterFirst(topBatters.data as LeaderRow[] | undefined)}
              showRank
            />
          </SectionCard>
          <SectionCard title="投手揮空率 TOP 10（PA≥50）">
            <DataTable
              columns={TOP_PITCHER_COLS}
              rows={filterFirst(topPitchers.data as LeaderRow[] | undefined)}
              showRank
            />
          </SectionCard>
        </div>
      </Section>

      {leagueLeaders.data && (
        <Section title="League Leaders">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              { key: "wOBA_first_batter", label: "wOBA 領先 (一軍打者)", metric: "woba", kind: "f3" as const },
              { key: "Whiff_first_pitcher", label: "Whiff% 領先 (一軍投手)", metric: "metric", kind: "pct" as const },
              { key: "EVmax_batter", label: "Max Exit Velocity", metric: "metric", kind: "f1" as const, unit: " kph" },
              { key: "Barrel_batter", label: "Barrels (一軍打者)", metric: "metric", kind: "int" as const },
            ].map((cfg) => (
              <SectionCard key={cfg.key} title={cfg.label}>
                <ol className="space-y-0.5 text-xs">
                  {leagueLeaders.data[cfg.key]?.map((r, i) => (
                    <li key={r.player_id as string} className="flex justify-between gap-1">
                      <Link
                        href={`/players/${r.player_id}`}
                        className="text-slate-900 hover:text-blue-700 truncate"
                      >
                        {i + 1}. {r.player_name}
                      </Link>
                      <span className="tabular-nums font-bold text-slate-900">
                        {fmt(r[cfg.metric] as number, cfg.kind)}{cfg.unit ?? ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </SectionCard>
            ))}
          </div>
        </Section>
      )}

    </div>
  );
}

