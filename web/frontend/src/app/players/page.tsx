"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <div>
        <h1 className="text-2xl font-bold">球員名鑑</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {players.data?.length ?? "—"} 位球員
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="搜尋姓名或 ID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select value={division} onValueChange={setDivision}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="first">一軍</SelectItem>
            <SelectItem value="second">二軍</SelectItem>
          </SelectContent>
        </Select>
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="所有球隊" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">所有球隊</SelectItem>
            {teams.data?.map((t) => (
              <SelectItem key={t.team_code} value={t.team_name}>
                {t.team_name} ({t.players})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {players.data?.map((p) => (
          <Link key={p.player_id} href={`/players/${p.player_id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-3">
                <div className="aspect-square bg-muted rounded mb-2 overflow-hidden flex items-center justify-center">
                  {p.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.image_url}
                      alt={p.name ?? ""}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl text-muted-foreground">
                      {p.jersey_number}
                    </span>
                  )}
                </div>
                <div className="font-semibold text-sm truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {p.team_name}
                </div>
                <div className="flex justify-between items-center mt-1">
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {p.position_name || "—"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    #{p.jersey_number}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
