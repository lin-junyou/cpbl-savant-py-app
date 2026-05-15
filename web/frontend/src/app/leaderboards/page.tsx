"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Board = {
  id: string;
  label: string;
  defaultSort: string;
  asc?: boolean;
  cols: { key: string; label: string; fmt?: "f3" | "pct1" | "int" | "f1" }[];
};

// NOTE: column keys must match the snake_cased PascalCase fields in
// rankings_* tables (e.g. "Kp" -> "kp", "HardHitp" -> "hard_hitp"), not the
// `_pct` aliases used in player_season.
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
      { key: "kp", label: "K%", fmt: "pct1" },
      { key: "bbp", label: "BB%", fmt: "pct1" },
      { key: "hard_hitp", label: "HardHit%", fmt: "pct1" },
      { key: "brlp", label: "Barrel%", fmt: "pct1" },
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
      { key: "kp", label: "K%", fmt: "pct1" },
      { key: "bbp", label: "BB%", fmt: "pct1" },
      { key: "whiffp", label: "Whiff%", fmt: "pct1" },
      { key: "chasep", label: "Chase%", fmt: "pct1" },
      { key: "hard_hitp", label: "對手HardHit%", fmt: "pct1" },
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
      { key: "hard_hitp", label: "強擊%", fmt: "pct1" },
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

function fmtVal(v: unknown, type?: string) {
  if (v == null || v === "") return "—";
  const num = Number(v);
  if (isNaN(num)) return String(v);
  if (type === "pct1") return (num * 100).toFixed(1) + "%";
  if (type === "f3") return num.toFixed(3);
  if (type === "f1") return num.toFixed(1);
  if (type === "int") return Math.round(num).toLocaleString();
  return String(v);
}

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">排行榜</h1>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">榜單</label>
          <Select
            value={board}
            onValueChange={(v) => {
              setBoard(v);
              const b = BOARDS.find((x) => x.id === v)!;
              setSortBy(b.defaultSort);
              setAsc(b.asc ?? false);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BOARDS.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">排序</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {config.cols.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">方向</label>
          <Select value={asc ? "asc" : "desc"} onValueChange={(v) => setAsc(v === "asc")}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">高 → 低</SelectItem>
              <SelectItem value="asc">低 → 高</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">最低 PA</label>
          <Input
            type="number"
            value={minPa}
            onChange={(e) => setMinPa(e.target.value)}
            className="w-24"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {config.label}（{data.data?.length ?? "—"} 列）
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2 pr-3">#</th>
                <th className="text-left py-2 pr-3">球員</th>
                <th className="text-left py-2 pr-3">球隊</th>
                {config.cols.map((c) => (
                  <th key={c.key} className="text-right py-2 px-2">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data?.map((r, i) => (
                <tr key={(r.player_id as string) + i} className="border-b hover:bg-muted/40">
                  <td className="py-1.5 pr-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 pr-3">
                    {r.player_id ? (
                      <Link
                        href={`/players/${r.player_id}`}
                        className="font-medium hover:underline"
                      >
                        {r.player_name as string}
                      </Link>
                    ) : (
                      <span>{r.player_name as string}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {r.team_name as string}
                  </td>
                  {config.cols.map((c) => (
                    <td
                      key={c.key}
                      className="text-right py-1.5 px-2 tabular-nums"
                    >
                      {fmtVal(r[c.key], c.fmt)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
