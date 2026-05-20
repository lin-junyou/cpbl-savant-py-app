"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
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
import {
  PageHeader,
  SectionCard,
  DataTable,
  LoadingState,
  ErrorState,
  type Column,
} from "@/components/common";
import { useTabParam } from "@/lib/hooks/useTabParam";

type Pitcher = Record<string, unknown>;
type Hitter = Record<string, unknown>;

const PITCHER_COLS: Column<Pitcher>[] = [
  { key: "team_name", label: "球隊", render: (r) => <span className="text-slate-700 text-xs">{r.team_name as string}</span> },
  { key: "pitcher_name", label: "投手", cellClassName: "font-medium" },
  { key: "role_type", label: "角色" },
  { key: "ip", label: "IP", align: "right", render: (r) => <>{r.inning_pitched_cnt as number}.{r.inning_pitched_div3_cnt as number}</> },
  { key: "plate_appearances", label: "PA", fmt: "int", align: "right" },
  { key: "hitting_cnt", label: "H", fmt: "int", align: "right" },
  { key: "home_run_cnt", label: "HR", fmt: "int", align: "right" },
  { key: "bases_onballs_cnt", label: "BB", fmt: "int", align: "right" },
  { key: "strike_out_cnt", label: "K", fmt: "int", align: "right" },
  { key: "earned_run_cnt", label: "ER", fmt: "int", align: "right" },
  { key: "pitch_cnt", label: "球數", fmt: "int", align: "right" },
  { key: "era", label: "ERA", fmt: "f2", align: "right" },
];

const HITTER_COLS: Column<Hitter>[] = [
  { key: "team_name", label: "球隊", render: (r) => <span className="text-slate-700 text-xs">{r.team_name as string}</span> },
  { key: "hitter_name", label: "打者", cellClassName: "font-medium" },
  { key: "defend_station", label: "守" },
  { key: "plate_appearances", label: "PA", fmt: "int", align: "right" },
  { key: "hitting_cnt", label: "AB", fmt: "int", align: "right" },
  { key: "hit_cnt", label: "H", fmt: "int", align: "right" },
  { key: "two_base_hit_cnt", label: "2B", fmt: "int", align: "right" },
  { key: "three_base_hit_cnt", label: "3B", fmt: "int", align: "right" },
  { key: "home_run_cnt", label: "HR", fmt: "int", align: "right" },
  { key: "run_batted_incnt", label: "RBI", fmt: "int", align: "right" },
  { key: "bases_onballs_cnt", label: "BB", fmt: "int", align: "right" },
  { key: "strike_out_cnt", label: "K", fmt: "int", align: "right" },
];

export default function GameDetailPage() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;
  const game = useQuery({ queryKey: ["game", gameId], queryFn: () => api.game(gameId) });
  const [pitcherFilter, setPitcherFilter] = useState<string>("__all");
  const [tab, setTab] = useTabParam("trajectory3d");

  const trajectory = useQuery({
    queryKey: ["trajectory", gameId, pitcherFilter],
    queryFn: () =>
      api.trajectory(gameId, pitcherFilter === "__all" ? undefined : pitcherFilter),
  });

  if (game.isLoading) return <LoadingState size="page" />;
  if (game.error || !game.data) return <ErrorState error={game.error} size="page" />;
  const { game: g, hitters, pitchers, innings } = game.data;

  const pitcherList = Array.from(
    new Map(
      pitchers
        .filter((p) => p.pitcher_acnt)
        .map((p) => [p.pitcher_acnt as string, p.pitcher_name as string]),
    ),
  );

  const visitingInnings = innings.filter((i) => i.side === "Visiting");
  const homeInnings = innings.filter((i) => i.side === "Home");

  const PitcherFilter = (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-slate-800">投手</span>
      <Select value={pitcherFilter} onValueChange={setPitcherFilter}>
        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">全部</SelectItem>
          {pitcherList.map(([id, name]) => (
            <SelectItem key={id} value={id}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-slate-700">{trajectory.data?.length ?? 0} 球</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={g.game_id}
        subtitle={`${g.date as string} · ${g.field_name as string} · ${g.kind_code === "A" ? "一軍" : "二軍"}`}
      />

      <SectionCard flush>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-700 border-b">
            <tr>
              <th className="text-left py-2 pl-4">球隊</th>
              {visitingInnings.map((i) => (
                <th key={i.inning as number} className="text-center px-1">{i.inning as number}</th>
              ))}
              <th className="text-center px-2 pr-4">R</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-1.5 pl-4 font-medium">{g.visiting_team_name as string}</td>
              {visitingInnings.map((i) => (
                <td key={i.inning as number} className="text-center px-1 tabular-nums">{(i.runs as number | null) ?? "X"}</td>
              ))}
              <td className="text-center px-2 pr-4 tabular-nums font-bold">{g.visiting_score as number}</td>
            </tr>
            <tr>
              <td className="py-1.5 pl-4 font-medium">{g.home_team_name as string}</td>
              {homeInnings.map((i) => (
                <td key={i.inning as number} className="text-center px-1 tabular-nums">{(i.runs as number | null) ?? "X"}</td>
              ))}
              <td className="text-center px-2 pr-4 tabular-nums font-bold">{g.home_score as number}</td>
            </tr>
          </tbody>
        </table>
      </SectionCard>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="trajectory3d">3D 軌跡</TabsTrigger>
          <TabsTrigger value="trajectory">2D 軌跡</TabsTrigger>
          <TabsTrigger value="pitchers">投手</TabsTrigger>
          <TabsTrigger value="hitters">打者</TabsTrigger>
        </TabsList>

        <TabsContent value="trajectory3d">
          <SectionCard
            title="3D 進壘軌跡 + 立體 9 宮格好球帶（拖曳旋轉、滾輪縮放、右鍵平移）"
            actions={PitcherFilter}
          >
            {trajectory.data ? (
              <StrikeZone3D pitches={trajectory.data} height={620} />
            ) : (
              <LoadingState />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="trajectory">
          <SectionCard title="3D 進壘軌跡（PolyFit 還原）" actions={PitcherFilter}>
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-slate-800 mb-1">側面（投手 → 本壘）</div>
                {trajectory.data ? <Trajectory pitches={trajectory.data} view="side" width={460} /> : null}
              </div>
              <div>
                <div className="text-xs uppercase text-slate-800 mb-1">俯視（從上往下看）</div>
                {trajectory.data ? <Trajectory pitches={trajectory.data} view="top" width={460} /> : null}
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="pitchers">
          <SectionCard title="投手成績">
            <DataTable columns={PITCHER_COLS} rows={pitchers as Pitcher[]} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="hitters">
          <SectionCard title="打者成績">
            <DataTable columns={HITTER_COLS} rows={hitters as Hitter[]} />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
