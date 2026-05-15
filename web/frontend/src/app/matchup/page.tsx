"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PITCH_COLORS } from "@/components/charts/StrikeZone";
import { StrikeZone } from "@/components/charts/StrikeZone";

export default function MatchupPage() {
  const search = useSearchParams();
  const router = useRouter();
  const pid = search.get("p") ?? "";
  const bid = search.get("b") ?? "";

  const matchup = useQuery({
    queryKey: ["matchup", pid, bid],
    queryFn: () => api.matchup(pid, bid),
    enabled: !!pid && !!bid,
  });
  const pProfile = useQuery({
    queryKey: ["player", pid], queryFn: () => api.player(pid), enabled: !!pid,
  });
  const bProfile = useQuery({
    queryKey: ["player", bid], queryFn: () => api.player(bid), enabled: !!bid,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">投打對戰 Matchup</h1>
        <p className="text-sm text-slate-700 mt-1">選一位投手與一位打者，查看歷史對戰數據</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PlayerPicker
          label="投手"
          role="pitcher"
          value={pid}
          onSelect={(id) => router.replace(`/matchup?p=${id}&b=${bid}`)}
        />
        <PlayerPicker
          label="打者"
          role="hitter"
          value={bid}
          onSelect={(id) => router.replace(`/matchup?p=${pid}&b=${id}`)}
        />
      </div>

      {pid && bid && matchup.data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">
                {pProfile.data?.bio.name} vs {bProfile.data?.bio.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                {[
                  ["Pitches", matchup.data.n],
                  ["Swings", matchup.data.swings],
                  ["Whiffs", matchup.data.whiffs],
                  ["Hits", matchup.data.hits],
                  ["HR", matchup.data.hr],
                ].map(([l, v]) => (
                  <div key={l} className="border-l-2 border-slate-300 pl-2">
                    <div className="text-xs text-slate-700">{l}</div>
                    <div className="text-xl font-bold tabular-nums text-slate-900">{v}</div>
                  </div>
                ))}
              </div>
              {Object.keys(matchup.data.type_breakdown).length > 0 && (
                <div className="mt-4">
                  <div className="text-xs uppercase font-semibold text-slate-700 mb-2">
                    球種分佈
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(matchup.data.type_breakdown).map(([t, n]) => (
                      <span key={t} className="inline-flex items-center gap-1.5 text-sm">
                        <span className="inline-block w-3 h-3 rounded-full"
                          style={{ background: PITCH_COLORS[t] ?? "#888" }} />
                        <span className="font-semibold" style={{ color: PITCH_COLORS[t] ?? "#0f172a" }}>{t}</span>
                        <span className="text-slate-700 tabular-nums">{n} 球</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {matchup.data.pitches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-slate-900">球路位置</CardTitle>
              </CardHeader>
              <CardContent>
                <StrikeZone
                  pitches={matchup.data.pitches.map((p) => ({
                    plate_loc_side: p.plate_loc_side as number,
                    plate_loc_height: p.plate_loc_height as number,
                    auto_pitch_type: p.auto_pitch_type as string,
                    pitch_call: p.pitch_call as string,
                    rel_speed_kph: p.rel_speed_kph as number,
                  }))}
                  pitchTypeFilter={null}
                  width={420}
                  height={500}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {(!pid || !bid) && (
        <div className="text-center py-12 text-slate-700">
          選一位投手與打者開始
        </div>
      )}
    </div>
  );
}

function PlayerPicker({
  label, role, value, onSelect,
}: {
  label: string;
  role: "pitcher" | "hitter";
  value: string;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const cands = useQuery({
    queryKey: ["picker", q],
    queryFn: () => api.players({ q }),
    enabled: q.trim().length > 0,
  });
  const selected = useQuery({
    queryKey: ["player", value], queryFn: () => api.player(value), enabled: !!value,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-slate-900">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {selected.data && (
          <div className="mb-3 p-2 bg-slate-100 rounded flex items-center gap-2">
            <span className="font-semibold">{selected.data.bio.name as string}</span>
            <span className="text-xs text-slate-700">
              {selected.data.bio.team_name as string}
            </span>
            <button
              onClick={() => onSelect("")}
              className="ml-auto text-slate-500 hover:text-red-600"
            >✕</button>
          </div>
        )}
        <div className="relative">
          <Input
            placeholder={`搜尋${label}姓名...`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && cands.data && (
            <div className="absolute top-full mt-1 left-0 right-0 max-h-72 overflow-y-auto bg-white border rounded-md shadow-lg z-10">
              {cands.data
                .filter((p) =>
                  role === "pitcher"
                    ? p.position_code === "1"
                    : p.position_code !== "1",
                )
                .slice(0, 10)
                .map((p) => (
                  <button
                    key={p.player_id}
                    onClick={() => { onSelect(p.player_id); setQ(""); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                  >
                    <span className="font-semibold">{p.name}</span>{" "}
                    <span className="text-slate-700 text-xs">
                      · {p.team_name} · {p.position_name}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
