"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  PageHeader,
  Section,
  SectionCard,
  PlayerCard,
  DataTable,
  LoadingState,
  ErrorState,
  type Column,
} from "@/components/common";

type LeaderRow = Record<string, unknown> & {
  player_id?: string;
  player_name?: string;
  position_name?: string;
};

const LEADER_COLS: Column<LeaderRow>[] = [
  {
    key: "player_name",
    label: "球員",
    render: (r) =>
      r.player_id ? (
        <Link
          href={`/players/${r.player_id}`}
          className="text-blue-700 hover:underline font-medium"
        >
          {r.player_name as string}
        </Link>
      ) : (
        (r.player_name as string)
      ),
  },
  { key: "position_name", label: "守", align: "left" },
  { key: "pa", label: "PA", fmt: "int", align: "right" },
  { key: "woba", label: "wOBA", fmt: "f3", align: "right" },
  { key: "k_pct", label: "K%", fmt: "pct", align: "right" },
  { key: "bb_pct", label: "BB%", fmt: "pct", align: "right" },
];

export default function TeamDetailPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const team = useQuery({ queryKey: ["team", code], queryFn: () => api.team(code) });

  if (team.isLoading) return <LoadingState size="page" />;
  if (team.error || !team.data) return <ErrorState error={team.error} size="page" />;
  const { team_name, players, leaders } = team.data;

  const pitchers = players.filter((p) => p.position_code === "1");
  const hitters = players.filter((p) => p.position_code !== "1");

  return (
    <div className="space-y-6">
      <PageHeader
        title={team_name}
        size="lg"
        subtitle={`${players.length} 位球員（投手 ${pitchers.length} · 野手 ${hitters.length}）`}
      />

      {leaders.length > 0 && (
        <SectionCard title="PA 領先者">
          <DataTable
            columns={LEADER_COLS}
            rows={leaders.slice(0, 15) as LeaderRow[]}
            rowKey={(r, i) => `${r.player_id ?? ""}-${i}`}
          />
        </SectionCard>
      )}

      <Section title="投手">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {pitchers.map((p) => <PlayerCard key={p.player_id} player={p} variant="grid" />)}
        </div>
      </Section>

      <Section title="野手">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {hitters.map((p) => <PlayerCard key={p.player_id} player={p} variant="grid" />)}
        </div>
      </Section>
    </div>
  );
}
