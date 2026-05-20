"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PageHeader,
  FilterBar,
  PlayerCard,
  LoadingState,
  EmptyState,
} from "@/components/common";

export default function PlayersPage() {
  const [q, setQ] = useState("");
  const [team, setTeam] = useState<string>("__all");
  const [division, setDivision] = useState<string>("first");

  const teams = useQuery({ queryKey: ["teams"], queryFn: api.teams });
  const players = useQuery({
    queryKey: ["players", q, team, division],
    queryFn: () =>
      api.players({
        q: q || undefined,
        team: team === "__all" ? undefined : team,
        division: division === "all" ? undefined : division,
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="球員名鑑"
        subtitle={`${players.data?.length ?? "—"} 位球員`}
      />

      <FilterBar>
        <FilterBar.Field label="搜尋">
          <Input
            placeholder="姓名或 ID..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56"
          />
        </FilterBar.Field>
        <FilterBar.Field label="分區">
          <Select value={division} onValueChange={setDivision}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="first">一軍</SelectItem>
              <SelectItem value="second">二軍</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="球隊">
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger className="w-48"><SelectValue placeholder="所有球隊" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">所有球隊</SelectItem>
              {teams.data?.map((t) => (
                <SelectItem key={t.team_code} value={t.team_name}>
                  {t.team_name} ({t.players})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
      </FilterBar>

      {players.isLoading ? (
        <LoadingState />
      ) : players.data && players.data.length === 0 ? (
        <EmptyState text="沒有符合條件的球員" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {players.data?.map((p) => (
            <PlayerCard key={p.player_id} player={p} variant="grid" />
          ))}
        </div>
      )}
    </div>
  );
}
