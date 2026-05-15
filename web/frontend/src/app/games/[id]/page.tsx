"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trajectory } from "@/components/charts/Trajectory";
import { StrikeZone3D } from "@/components/charts/StrikeZone3D";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GameDetailPage() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;

  const game = useQuery({ queryKey: ["game", gameId], queryFn: () => api.game(gameId) });
  const [pitcherFilter, setPitcherFilter] = useState<string>("__all");

  const trajectory = useQuery({
    queryKey: ["trajectory", gameId, pitcherFilter],
    queryFn: () =>
      api.trajectory(
        gameId,
        pitcherFilter === "__all" ? undefined : pitcherFilter,
      ),
  });

  if (game.isLoading) return <div>載入中...</div>;
  if (game.error || !game.data) return <div>錯誤</div>;
  const { game: g, hitters, pitchers, innings } = game.data;

  const pitcherList = Array.from(
    new Map(
      pitchers
        .filter((p) => p.pitcher_acnt)
        .map((p) => [
          p.pitcher_acnt as string,
          p.pitcher_name as string,
        ]),
    ),
  );

  const visitingInnings = innings.filter((i) => i.side === "Visiting");
  const homeInnings = innings.filter((i) => i.side === "Home");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{g.game_id}</h1>
        <p className="text-sm text-muted-foreground">
          {g.date as string} · {g.field_name as string} ·{" "}
          {g.kind_code === "A" ? "一軍" : "二軍"}
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left">球隊</th>
                {visitingInnings.map((i) => (
                  <th key={i.inning as number} className="text-center px-1">
                    {i.inning as number}
                  </th>
                ))}
                <th className="text-center px-2">R</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-1 font-medium">{g.visiting_team_name as string}</td>
                {visitingInnings.map((i) => (
                  <td
                    key={i.inning as number}
                    className="text-center px-1 tabular-nums"
                  >
                    {i.runs ?? "X"}
                  </td>
                ))}
                <td className="text-center px-2 tabular-nums font-bold">
                  {g.visiting_score as number}
                </td>
              </tr>
              <tr>
                <td className="py-1 font-medium">{g.home_team_name as string}</td>
                {homeInnings.map((i) => (
                  <td
                    key={i.inning as number}
                    className="text-center px-1 tabular-nums"
                  >
                    {i.runs ?? "X"}
                  </td>
                ))}
                <td className="text-center px-2 tabular-nums font-bold">
                  {g.home_score as number}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Tabs defaultValue="trajectory3d">
        <TabsList>
          <TabsTrigger value="trajectory3d">3D 軌跡</TabsTrigger>
          <TabsTrigger value="trajectory">2D 軌跡</TabsTrigger>
          <TabsTrigger value="pitchers">投手</TabsTrigger>
          <TabsTrigger value="hitters">打者</TabsTrigger>
        </TabsList>

        <TabsContent value="trajectory3d">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                3D 進壘軌跡 + 立體 9 宮格好球帶（拖曳旋轉、滾輪縮放、右鍵平移）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex gap-3 items-center">
                <span className="text-sm">投手：</span>
                <Select value={pitcherFilter} onValueChange={setPitcherFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">全部</SelectItem>
                    {pitcherList.map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {trajectory.data?.length ?? 0} 球
                </span>
              </div>
              {trajectory.data ? (
                <StrikeZone3D pitches={trajectory.data} height={620} />
              ) : (
                <div className="text-muted-foreground py-12 text-center">
                  載入中...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trajectory">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3D 進壘軌跡（PolyFit 還原）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex gap-3 items-center">
                <span className="text-sm">投手：</span>
                <Select value={pitcherFilter} onValueChange={setPitcherFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">全部</SelectItem>
                    {pitcherList.map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {trajectory.data?.length ?? 0} 球
                </span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">
                    側面（投手 → 本壘）
                  </div>
                  {trajectory.data ? (
                    <Trajectory pitches={trajectory.data} view="side" width={460} />
                  ) : null}
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">
                    俯視（從上往下看）
                  </div>
                  {trajectory.data ? (
                    <Trajectory pitches={trajectory.data} view="top" width={460} />
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pitchers">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">投手成績</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2">球隊</th>
                    <th className="text-left py-2">投手</th>
                    <th className="text-left py-2">角色</th>
                    <th className="text-right">IP</th>
                    <th className="text-right">PA</th>
                    <th className="text-right">H</th>
                    <th className="text-right">HR</th>
                    <th className="text-right">BB</th>
                    <th className="text-right">K</th>
                    <th className="text-right">ER</th>
                    <th className="text-right">球數</th>
                    <th className="text-right">ERA</th>
                  </tr>
                </thead>
                <tbody>
                  {pitchers.map((p, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1.5 text-xs text-muted-foreground">
                        {p.team_name as string}
                      </td>
                      <td className="py-1.5 font-medium">{p.pitcher_name}</td>
                      <td className="py-1.5">{p.role_type}</td>
                      <td className="text-right tabular-nums">
                        {p.inning_pitched_cnt}.{p.inning_pitched_div3_cnt}
                      </td>
                      <td className="text-right tabular-nums">{p.plate_appearances as number}</td>
                      <td className="text-right tabular-nums">{p.hitting_cnt as number}</td>
                      <td className="text-right tabular-nums">{p.home_run_cnt as number}</td>
                      <td className="text-right tabular-nums">{p.bases_on_balls_cnt as number}</td>
                      <td className="text-right tabular-nums">{p.strike_out_cnt as number}</td>
                      <td className="text-right tabular-nums">{p.earned_run_cnt as number}</td>
                      <td className="text-right tabular-nums">{p.pitch_cnt as number}</td>
                      <td className="text-right tabular-nums">{p.era as number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hitters">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">打者成績</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2">球隊</th>
                    <th className="text-left py-2">打者</th>
                    <th className="text-left py-2">守</th>
                    <th className="text-right">PA</th>
                    <th className="text-right">AB</th>
                    <th className="text-right">H</th>
                    <th className="text-right">2B</th>
                    <th className="text-right">3B</th>
                    <th className="text-right">HR</th>
                    <th className="text-right">RBI</th>
                    <th className="text-right">BB</th>
                    <th className="text-right">K</th>
                  </tr>
                </thead>
                <tbody>
                  {hitters.map((h, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1.5 text-xs text-muted-foreground">
                        {h.team_name as string}
                      </td>
                      <td className="py-1.5 font-medium">{h.hitter_name}</td>
                      <td className="py-1.5">{h.defend_station}</td>
                      <td className="text-right tabular-nums">{h.plate_appearances as number}</td>
                      <td className="text-right tabular-nums">{h.hitting_cnt as number}</td>
                      <td className="text-right tabular-nums">{h.hit_cnt as number}</td>
                      <td className="text-right tabular-nums">{h.two_base_hit_cnt as number}</td>
                      <td className="text-right tabular-nums">{h.three_base_hit_cnt as number}</td>
                      <td className="text-right tabular-nums">{h.home_run_cnt as number}</td>
                      <td className="text-right tabular-nums">{h.run_batted_in_cnt as number}</td>
                      <td className="text-right tabular-nums">{h.bases_on_balls_cnt as number}</td>
                      <td className="text-right tabular-nums">{h.strike_out_cnt as number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
