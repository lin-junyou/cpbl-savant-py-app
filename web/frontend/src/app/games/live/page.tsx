"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/common";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  FINISHED:  { label: "已結束", color: "bg-slate-300 text-slate-800" },
  START:     { label: "進行中", color: "bg-red-600 text-white animate-pulse" },
  SCHEDULED: { label: "未開始", color: "bg-blue-200 text-blue-900" },
  POSTPONED: { label: "延賽",   color: "bg-amber-200 text-amber-900" },
};

export default function LivePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const games = useQuery({
    queryKey: ["live", date],
    queryFn: () => api.schedule({ start: date, end: date, limit: 50 }),
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 30_000;
      return data.some((g) => g.game_status === "START") ? 30_000 : 60_000;
    },
  });

  const live = games.data?.filter((g) => g.game_status === "START") ?? [];
  const upcoming = games.data?.filter((g) => g.game_status === "SCHEDULED") ?? [];
  const finished = games.data?.filter((g) => g.game_status === "FINISHED") ?? [];
  const postponed = games.data?.filter((g) => g.game_status === "POSTPONED") ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="🔴 即時比賽 Live"
        subtitle={`最後更新：${games.dataUpdatedAt ? new Date(games.dataUpdatedAt).toLocaleTimeString() : "—"}`}
        actions={
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-white"
          />
        }
      />

      {live.length > 0 && (
        <Section
          title={
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" /> 進行中（{live.length}）
            </span>
          }
          tone="red"
        >
          {live.map((g) => <GameCard key={g.game_id} g={g} live />)}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title={`即將開賽（${upcoming.length}）`} tone="blue">
          {upcoming.map((g) => <GameCard key={g.game_id} g={g} />)}
        </Section>
      )}

      {finished.length > 0 && (
        <Section title={`已結束（${finished.length}）`} tone="slate">
          {finished.map((g) => <GameCard key={g.game_id} g={g} />)}
        </Section>
      )}

      {postponed.length > 0 && (
        <Section title={`延賽（${postponed.length}）`} tone="amber">
          {postponed.map((g) => <GameCard key={g.game_id} g={g} />)}
        </Section>
      )}

      {games.data && games.data.length === 0 && (
        <Card><CardContent className="p-0"><EmptyState size="page" text={`${date} 沒有比賽`} /></CardContent></Card>
      )}
      <span className="hidden">{now.toISOString()}</span>
    </div>
  );
}

const TONE_CLS = {
  red: "text-red-600",
  blue: "text-blue-700",
  slate: "text-slate-700",
  amber: "text-amber-700",
} as const;

function Section({
  title, tone, children,
}: { title: React.ReactNode; tone: keyof typeof TONE_CLS; children: React.ReactNode }) {
  return (
    <section>
      <h2 className={`text-lg font-bold mb-2 flex items-center gap-2 ${TONE_CLS[tone]}`}>{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function GameCard({
  g, live,
}: {
  g: {
    game_id: string; date: string; game_status: string; kind_code: string;
    visiting_team_name: string; home_team_name: string;
    visiting_score: number | null; home_score: number | null;
    field_name: string | null; winning_pitcher_name: string | null;
  };
  live?: boolean;
}) {
  const status = STATUS_LABEL[g.game_status] ?? { label: g.game_status, color: "bg-slate-200" };
  return (
    <Link href={`/games/${g.game_id}`}>
      <Card className={`hover:shadow-md transition-shadow ${live ? "ring-2 ring-red-500" : ""}`}>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <Badge className={status.color}>{status.label}</Badge>
            <span className="text-xs text-slate-700">
              {g.kind_code === "A" ? "一軍" : "二軍"} · {g.field_name}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-900">{g.visiting_team_name}</span>
              <span className="text-2xl font-bold tabular-nums text-slate-900">
                {g.visiting_score ?? "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-900">{g.home_team_name}</span>
              <span className="text-2xl font-bold tabular-nums text-slate-900">
                {g.home_score ?? "—"}
              </span>
            </div>
          </div>
          {g.winning_pitcher_name && (
            <div className="mt-2 text-xs text-slate-700">W: {g.winning_pitcher_name}</div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
