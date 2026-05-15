"use client";

/**
 * Plate-discipline metrics panel with optional RHB/LHB split.
 *
 * Layout: a grid of metric tiles (label + percentage) + a toggle to switch
 * the dataset between all batters / RHB / LHB.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  pid: string;
  role: "pitcher" | "hitter";
}

const METRIC_GROUPS: Array<{
  title: string;
  metrics: Array<[keyof Awaited<ReturnType<typeof api.playerPlateDiscipline>>, string, string]>;
}> = [
  {
    title: "Zone & Edge",
    metrics: [
      ["zone_pct", "Zone%", "進入好球帶比率"],
      ["edge_pct", "Edge%", "邊緣球帶比率"],
    ],
  },
  {
    title: "Swing 揮棒",
    metrics: [
      ["swing_pct", "Swing%", "全部球數揮棒率"],
      ["z_swing_pct", "Z-Swing%", "好球帶內揮棒率"],
      ["o_swing_pct", "O-Swing% (Chase)", "好球帶外揮棒率（追打）"],
    ],
  },
  {
    title: "Contact 接觸",
    metrics: [
      ["contact_pct", "Contact%", "揮到的比率"],
      ["z_contact_pct", "Z-Contact%", "好球帶內接觸率"],
      ["o_contact_pct", "O-Contact%", "好球帶外接觸率"],
      ["whiff_pct", "Whiff%", "揮空率"],
    ],
  },
];

export function PlateDiscipline({ pid, role }: Props) {
  const [batSide, setBatSide] = useState("");
  const q = useQuery({
    queryKey: ["pd", pid, role, batSide],
    queryFn: () => api.playerPlateDiscipline(pid, role, batSide),
  });
  const data = q.data;

  return (
    <div className="space-y-3">
      {role === "pitcher" && (
        <div className="flex gap-2 text-xs">
          <span className="text-slate-700 self-center">面對打者：</span>
          {[
            ["", "全部"],
            ["R", "右打"],
            ["L", "左打"],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setBatSide(v)}
              className={`px-2 py-1 rounded border ${
                batSide === v
                  ? "bg-slate-900 text-white"
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {data ? (
        <div className="space-y-3">
          {METRIC_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-xs uppercase font-semibold text-slate-700 mb-1.5">
                {g.title}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {g.metrics.map(([k, label, hint]) => {
                  const v = (data as Record<string, number>)[k as string];
                  return (
                    <div
                      key={k as string}
                      className="border-l-2 border-slate-300 pl-2"
                      title={hint}
                    >
                      <div className="text-[10px] uppercase tracking-wide text-slate-700">
                        {label}
                      </div>
                      <div className="font-bold text-base tabular-nums text-slate-900">
                        {typeof v === "number" ? `${v.toFixed(1)}%` : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="text-xs text-slate-700">
            樣本：{data.pitches} 球
          </div>
        </div>
      ) : (
        <div className="text-slate-700 py-6 text-center">載入中…</div>
      )}
    </div>
  );
}
