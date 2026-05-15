"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  const stadiums = useQuery({ queryKey: ["stadiums"], queryFn: api.stadiums });
  const teams = useQuery({ queryKey: ["teams"], queryFn: api.teams });
  const topBatters = useQuery({
    queryKey: ["top", "batter", "woba"],
    queryFn: () =>
      api.leaderboard("pr-batter", { sort_by: "woba", min_pa: 80, limit: 30 }),
  });
  const topPitchers = useQuery({
    queryKey: ["top", "pitcher", "whiffp"],
    queryFn: () =>
      api.leaderboard("pr-pitcher", { sort_by: "whiffp", min_pa: 50, limit: 30 }),
  });
  const leagueLeaders = useQuery({
    queryKey: ["league-leaders"],
    queryFn: api.leagueLeaders,
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold">CPBL Savant</h1>
        <p className="text-muted-foreground mt-2">
          中華職棒 2026 球季 Statcast 風格進階數據分析。
          資料庫共 {health.data?.players ?? "—"} 位球員，
          {stadiums.data?.reduce((s, x) => s + x.pitches, 0).toLocaleString() ?? "—"} 個 Trackman 球路。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">球場</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stadiums.data?.length ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              已記錄 Trackman 資料的球場
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">球隊</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teams.data?.length ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">一/二軍合計</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">球員</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{health.data?.players ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">含詳細進階數據</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">一軍打者 wOBA TOP 10（PA≥80）</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2">球員</th>
                  <th className="text-left pb-2">球隊</th>
                  <th className="text-right pb-2">PA</th>
                  <th className="text-right pb-2">wOBA</th>
                </tr>
              </thead>
              <tbody>
                {topBatters.data
                  ?.filter((r) => !(r.team_name as string)?.includes("二軍"))
                  ?.slice(0, 10)
                  ?.map((r, i) => (
                    <tr key={r.player_id as string} className="border-t">
                      <td className="py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="py-1.5">
                        <Link
                          href={`/players/${r.player_id}`}
                          className="font-medium hover:underline"
                        >
                          {r.player_name as string}
                        </Link>
                      </td>
                      <td className="py-1.5 text-muted-foreground">
                        {r.team_name as string}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {r.pa as number}
                      </td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">
                        {(r.woba as number)?.toFixed(3)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">投手揮空率 TOP 10（PA≥50）</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2">球員</th>
                  <th className="text-left pb-2">球隊</th>
                  <th className="text-right pb-2">PA</th>
                  <th className="text-right pb-2">Whiff%</th>
                </tr>
              </thead>
              <tbody>
                {topPitchers.data
                  ?.filter((r) => !(r.team_name as string)?.includes("二軍"))
                  ?.slice(0, 10)
                  ?.map((r, i) => (
                    <tr key={r.player_id as string} className="border-t">
                      <td className="py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="py-1.5">
                        <Link
                          href={`/players/${r.player_id}`}
                          className="font-medium hover:underline"
                        >
                          {r.player_name as string}
                        </Link>
                      </td>
                      <td className="py-1.5 text-muted-foreground">
                        {r.team_name as string}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {r.pa as number}
                      </td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">
                        {((r.whiffp as number) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {leagueLeaders.data && (
        <section>
          <h2 className="text-xl font-semibold mb-3">League Leaders</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              { key: "wOBA_first_batter", label: "wOBA 領先 (一軍打者)", metric: "woba", fmt: (v: number) => v.toFixed(3) },
              { key: "Whiff_first_pitcher", label: "Whiff% 領先 (一軍投手)", metric: "metric", fmt: (v: number) => (v * 100).toFixed(1) + "%" },
              { key: "EVmax_batter", label: "Max Exit Velocity", metric: "metric", fmt: (v: number) => v.toFixed(1) + " kph" },
              { key: "Barrel_batter", label: "Barrels (一軍打者)", metric: "metric", fmt: (v: number) => String(v) },
            ].map((cfg) => (
              <Card key={cfg.key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{cfg.label}</CardTitle>
                </CardHeader>
                <CardContent>
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
                          {cfg.fmt(r[cfg.metric] as number)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-3">技術堆疊</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">FastAPI 後端</Badge>
          <Badge variant="secondary">Next.js 15 + Shadcn UI</Badge>
          <Badge variant="secondary">D3.js 視覺化</Badge>
          <Badge variant="secondary">Trackman 進壘軌跡</Badge>
          <Badge variant="secondary">逐球落點</Badge>
        </div>
      </section>
    </div>
  );
}
