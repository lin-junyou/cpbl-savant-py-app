"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, LoadingState } from "@/components/common";

export default function GamesPage() {
  const games = useQuery({
    queryKey: ["schedule"],
    queryFn: () => api.schedule({ limit: 200 }),
  });

  const grouped = (games.data ?? []).reduce<Record<string, typeof games.data>>(
    (acc, g) => {
      (acc[g.date] ??= []).push(g);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="賽程"
        subtitle={`${games.data?.length ?? "—"} 場比賽`}
        actions={
          <div className="flex items-center gap-3">
            <Link href="/games/live" className="text-sm text-red-600 hover:underline font-semibold">
              🔴 即時比賽
            </Link>
            <Link href="/games/calendar" className="text-sm text-blue-700 hover:underline">
              月曆視圖 →
            </Link>
          </div>
        }
      />
      {games.isLoading ? (
        <LoadingState />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, gs]) => (
            <Card key={date}>
              <CardHeader>
                <CardTitle className="text-base text-slate-900">{date}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {gs?.map((g) => (
                  <Link
                    key={g.game_id}
                    href={`/games/${g.game_id}`}
                    className="block rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline">
                          {g.kind_code === "A" ? "一軍" : "二軍"}
                        </Badge>
                        <span>{g.visiting_team_name}</span>
                        <span className="font-bold tabular-nums">{g.visiting_score}</span>
                        <span className="text-slate-700">@</span>
                        <span>{g.home_team_name}</span>
                        <span className="font-bold tabular-nums">{g.home_score}</span>
                      </div>
                      <div className="text-xs text-slate-700">
                        {g.field_name}
                        {g.winning_pitcher_name ? <> · W: {g.winning_pitcher_name}</> : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
