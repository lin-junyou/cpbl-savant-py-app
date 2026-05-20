"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  PageHeader,
  FilterBar,
  SectionCard,
  DataTable,
  LoadingState,
  type Column,
} from "@/components/common";
import type { FmtKind } from "@/lib/format";

type Board = {
  id: string;
  label: string;
  defaultSort: string;
  asc?: boolean;
  cols: { key: string; label: string; fmt?: FmtKind }[];
};

const BOARDS: Board[] = [
  {
    id: "pr-batter",
    label: "打者排行（PR）",
    defaultSort: "woba",
    cols: [
      { key: "pa", label: "PA", fmt: "int" },
      { key: "woba", label: "wOBA", fmt: "f3" },
      { key: "ba", label: "BA", fmt: "f3" },
      { key: "obp", label: "OBP", fmt: "f3" },
      { key: "slg", label: "SLG", fmt: "f3" },
      { key: "iso", label: "ISO", fmt: "f3" },
      { key: "kp", label: "K%", fmt: "pct" },
      { key: "bbp", label: "BB%", fmt: "pct" },
      { key: "hard_hitp", label: "HardHit%", fmt: "pct" },
      { key: "brlp", label: "Barrel%", fmt: "pct" },
    ],
  },
  {
    id: "pr-pitcher",
    label: "投手排行（被打 PR）",
    defaultSort: "woba",
    asc: true,
    cols: [
      { key: "pa", label: "TBF", fmt: "int" },
      { key: "woba", label: "對手wOBA", fmt: "f3" },
      { key: "kp", label: "K%", fmt: "pct" },
      { key: "bbp", label: "BB%", fmt: "pct" },
      { key: "whiffp", label: "Whiff%", fmt: "pct" },
      { key: "chasep", label: "Chase%", fmt: "pct" },
      { key: "hard_hitp", label: "對手HardHit%", fmt: "pct" },
      { key: "ev", label: "對手EV avg", fmt: "f1" },
    ],
  },
  {
    id: "exit-velocity-batter",
    label: "打者擊球初速",
    defaultSort: "ev_avg",
    cols: [
      { key: "bbe", label: "BBE", fmt: "int" },
      { key: "la_avg", label: "LA avg", fmt: "f1" },
      { key: "ev_avg", label: "EV avg", fmt: "f1" },
      { key: "ev_max", label: "EV max", fmt: "f1" },
      { key: "ev_90_th", label: "EV 90%", fmt: "f1" },
      { key: "hard_hit", label: "強擊", fmt: "int" },
      { key: "hard_hitp", label: "強擊%", fmt: "pct" },
      { key: "barrels", label: "Barrels", fmt: "int" },
      { key: "distance_max", label: "最遠 m", fmt: "f1" },
    ],
  },
  {
    id: "pitch-tracking",
    label: "球種追蹤",
    defaultSort: "kph_max",
    cols: [
      { key: "throws", label: "投球" },
      { key: "pitch_type", label: "球種" },
      { key: "pitches", label: "球數", fmt: "int" },
      { key: "kph", label: "Avg kph", fmt: "f1" },
      { key: "kph_max", label: "Max kph", fmt: "f1" },
      { key: "spin_rate", label: "Spin avg", fmt: "f1" },
      { key: "spin_rate_max", label: "Spin max", fmt: "f1" },
    ],
  },
];

type LeaderboardRow = Record<string, unknown> & {
  player_id?: string;
  player_name?: string;
  team_name?: string;
};

export default function LeaderboardsPage() {
  const [board, setBoard] = useState<string>(BOARDS[0].id);
  const [minPa, setMinPa] = useState("50");
  const config = BOARDS.find((b) => b.id === board)!;
  const [sortBy, setSortBy] = useState(config.defaultSort);
  const [asc, setAsc] = useState(config.asc ?? false);

  const data = useQuery({
    queryKey: ["leaderboard", board, sortBy, asc, minPa],
    queryFn: () =>
      api.leaderboard(board, {
        sort_by: sortBy,
        asc,
        min_pa: Number(minPa) || 0,
        limit: 200,
      }),
  });

  // Build columns: player+team prefix + dynamic metric columns
  const cols: Column<LeaderboardRow>[] = [
    {
      key: "player_name",
      label: "球員",
      render: (r) =>
        r.player_id ? (
          <Link href={`/players/${r.player_id}`} className="font-medium hover:underline text-slate-900">
            {r.player_name as string}
          </Link>
        ) : (
          <span>{r.player_name as string}</span>
        ),
    },
    {
      key: "team_name",
      label: "球隊",
      render: (r) => <span className="text-slate-700">{r.team_name as string}</span>,
    },
    ...config.cols.map<Column<LeaderboardRow>>((c) => ({
      key: c.key,
      label: c.label,
      fmt: c.fmt,
      align: "right" as const,
    })),
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="排行榜" subtitle={config.label} />

      <FilterBar>
        <FilterBar.Field label="榜單">
          <Select
            value={board}
            onValueChange={(v) => {
              setBoard(v);
              const b = BOARDS.find((x) => x.id === v)!;
              setSortBy(b.defaultSort);
              setAsc(b.asc ?? false);
            }}
          >
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BOARDS.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="排序">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {config.cols.map((c) => (
                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="方向">
          <Select value={asc ? "asc" : "desc"} onValueChange={(v) => setAsc(v === "asc")}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">高 → 低</SelectItem>
              <SelectItem value="asc">低 → 高</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="最低 PA">
          <Input
            type="number"
            value={minPa}
            onChange={(e) => setMinPa(e.target.value)}
            className="w-24"
          />
        </FilterBar.Field>
      </FilterBar>

      <SectionCard title={`${config.label}（${data.data?.length ?? "—"} 列）`}>
        {data.isLoading ? (
          <LoadingState />
        ) : (
          <DataTable
            columns={cols}
            rows={(data.data ?? []) as LeaderboardRow[]}
            rowKey={(r, i) => `${r.player_id ?? ""}-${i}`}
            showRank
          />
        )}
      </SectionCard>
    </div>
  );
}
