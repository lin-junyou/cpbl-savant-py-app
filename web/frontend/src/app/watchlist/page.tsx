"use client";

import { useQueries } from "@tanstack/react-query";
import { useWatchlist } from "@/lib/watchlist";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  PlayerCard,
  EmptyState,
  LoadingState,
} from "@/components/common";
import { fmtNum } from "@/lib/format";

export default function WatchlistPage() {
  const { list, clear } = useWatchlist();
  const profiles = useQueries({
    queries: list.map((pid) => ({
      queryKey: ["player", pid],
      queryFn: () => api.player(pid),
    })),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="⭐ 我的收藏"
        subtitle={list.length > 0 ? `${list.length} 位球員` : undefined}
        actions={
          list.length > 0 ? (
            <Button variant="outline" size="sm" onClick={clear}>清空全部</Button>
          ) : null
        }
      />

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-0">
            <EmptyState
              size="page"
              text="尚未收藏任何球員。在球員頁點 ⭐ 收藏即可加入。"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {profiles.map((q, i) => {
            const pid = list[i];
            if (q.isLoading)
              return (
                <Card key={pid}>
                  <CardContent className="p-0"><LoadingState size="tight" /></CardContent>
                </Card>
              );
            if (!q.data) return null;
            const b = q.data.bio;
            const s = q.data.season;
            return (
              <PlayerCard
                key={pid}
                variant="row"
                player={{
                  player_id: pid,
                  name: b.name as string,
                  image_url: b.image_url as string,
                  jersey_number: b.jersey_number as string,
                  position_name: b.position_name as string,
                  team_name: b.team_name as string,
                }}
                extra={
                  s?.woba != null ? (
                    <span className="text-xs tabular-nums text-slate-700">
                      wOBA <b className="text-slate-900">{fmtNum(s.woba as number)}</b>
                    </span>
                  ) : null
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
