"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TeamDetailPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const team = useQuery({
    queryKey: ["team", code],
    queryFn: () => api.team(code),
  });
  if (team.isLoading) return <div className="p-6">載入中...</div>;
  if (team.error || !team.data) return <div className="p-6">錯誤</div>;
  const { team_name, players, leaders } = team.data;

  // Group players by position group
  const pitchers = players.filter((p) => p.position_code === "1");
  const hitters = players.filter((p) => p.position_code !== "1");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{team_name}</h1>
        <p className="text-sm text-slate-700 mt-1">
          {players.length} 位球員（投手 {pitchers.length} · 野手 {hitters.length}）
        </p>
      </div>

      {leaders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-900">PA 領先者</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-700 border-b">
                <tr>
                  <th className="text-left py-2">球員</th>
                  <th className="text-left py-2">守</th>
                  <th className="text-right py-2">PA</th>
                  <th className="text-right py-2">wOBA</th>
                  <th className="text-right py-2">K%</th>
                  <th className="text-right py-2">BB%</th>
                </tr>
              </thead>
              <tbody>
                {leaders.slice(0, 15).map((l, i) => (
                  <tr key={(l.player_id as string) + i} className="border-b">
                    <td className="py-1.5">
                      <Link
                        href={`/players/${l.player_id}`}
                        className="text-blue-700 hover:underline font-medium"
                      >
                        {l.player_name as string}
                      </Link>
                    </td>
                    <td className="text-slate-700">
                      {l.position_name as string}
                    </td>
                    <td className="text-right tabular-nums">{l.pa as number}</td>
                    <td className="text-right tabular-nums font-bold">
                      {(l.woba as number)?.toFixed(3) ?? "—"}
                    </td>
                    <td className="text-right tabular-nums">
                      {l.k_pct != null ? ((l.k_pct as number) * 100).toFixed(1) + "%" : "—"}
                    </td>
                    <td className="text-right tabular-nums">
                      {l.bb_pct != null ? ((l.bb_pct as number) * 100).toFixed(1) + "%" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-900">投手</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {pitchers.map((p) => (
            <PlayerCard key={p.player_id} p={p} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-900">野手</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {hitters.map((p) => (
            <PlayerCard key={p.player_id} p={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PlayerCard({ p }: { p: { player_id: string; name: string | null; image_url: string | null; jersey_number: string | null; position_name: string | null; team_name: string | null } }) {
  return (
    <Link href={`/players/${p.player_id}`}>
      <Card className="hover:shadow-md transition-shadow h-full">
        <CardContent className="p-3">
          <div className="aspect-square bg-slate-200 rounded mb-2 overflow-hidden flex items-center justify-center">
            {p.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={p.image_url}
                alt={p.name ?? ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl text-slate-500">{p.jersey_number}</span>
            )}
          </div>
          <div className="font-semibold text-sm truncate text-slate-900">{p.name}</div>
          <div className="flex justify-between items-center mt-0.5">
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {p.position_name || "—"}
            </Badge>
            <span className="text-xs text-slate-500">#{p.jersey_number}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
