"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { useWatchlist } from "@/lib/watchlist";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">⭐ 我的收藏</h1>
        {list.length > 0 && (
          <Button variant="outline" size="sm" onClick={clear}>
            清空全部
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-700">
            尚未收藏任何球員。在球員頁點 <span className="font-semibold">⭐ 收藏</span> 即可加入。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {profiles.map((q, i) => {
            const pid = list[i];
            if (q.isLoading) return <Card key={pid}><CardContent className="p-4 text-sm text-slate-700">載入中…</CardContent></Card>;
            if (!q.data) return null;
            const b = q.data.bio;
            const s = q.data.season;
            return (
              <Link key={pid} href={`/players/${pid}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-3 flex gap-3">
                    <div className="w-16 h-16 rounded bg-slate-200 overflow-hidden flex-shrink-0">
                      {b.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={b.image_url as string} alt={b.name as string}
                          className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 truncate">
                        {b.name as string} <span className="text-xs text-slate-500">#{b.jersey_number as string}</span>
                      </div>
                      <div className="text-xs text-slate-700 truncate">
                        {b.team_name as string}
                      </div>
                      <div className="mt-1 flex gap-1.5 items-center">
                        <Badge variant="outline" className="text-[10px]">{b.position_name as string}</Badge>
                        {s?.woba != null ? (
                          <span className="text-xs tabular-nums text-slate-700">
                            wOBA <b className="text-slate-900">{(s.woba as number).toFixed(3)}</b>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
