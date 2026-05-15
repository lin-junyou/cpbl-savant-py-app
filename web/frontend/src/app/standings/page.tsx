"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StandingsPage() {
  const [kind, setKind] = useState("A");
  const q = useQuery({
    queryKey: ["standings", 2026, kind],
    queryFn: () => api.standings(2026, kind),
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">2026 戰績榜</h1>
        <div className="flex gap-2 text-sm">
          {[["A", "一軍"], ["D", "二軍"]].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 rounded border ${
                kind === k
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-slate-900">
            {kind === "A" ? "一軍" : "二軍"} 戰績
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {q.data && (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-700 border-b">
                <tr>
                  <th className="text-left py-2 pr-2">#</th>
                  <th className="text-left py-2 pr-2">球隊</th>
                  <th className="text-right px-2">W</th>
                  <th className="text-right px-2">L</th>
                  <th className="text-right px-2">T</th>
                  <th className="text-right px-2">勝率</th>
                  <th className="text-right px-2">GB</th>
                  <th className="text-right px-2">RS</th>
                  <th className="text-right px-2">RA</th>
                  <th className="text-right px-2">±</th>
                  <th className="text-right px-2">Pyth%</th>
                  <th className="text-right px-2">最近 10</th>
                </tr>
              </thead>
              <tbody>
                {q.data.map((t, i) => (
                  <tr key={t.team} className="border-b">
                    <td className="py-1.5 pr-2 text-slate-700">{i + 1}</td>
                    <td className="py-1.5 pr-2 font-bold text-slate-900">{t.team}</td>
                    <td className="text-right tabular-nums font-semibold">{t.w}</td>
                    <td className="text-right tabular-nums">{t.l}</td>
                    <td className="text-right tabular-nums">{t.t}</td>
                    <td className="text-right tabular-nums font-bold">
                      {t.pct.toFixed(3)}
                    </td>
                    <td className="text-right tabular-nums">
                      {t.gb === 0 ? "—" : t.gb.toFixed(1)}
                    </td>
                    <td className="text-right tabular-nums">{t.rs}</td>
                    <td className="text-right tabular-nums">{t.ra}</td>
                    <td className={`text-right tabular-nums ${t.diff > 0 ? "text-red-600" : t.diff < 0 ? "text-blue-600" : ""}`}>
                      {t.diff > 0 ? "+" : ""}{t.diff}
                    </td>
                    <td className="text-right tabular-nums text-slate-700">
                      {t.pyth.toFixed(3)}
                    </td>
                    <td className="text-right tabular-nums">{t.last10}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-slate-700">
            <b>Pyth%</b> = Pythagorean expected winning percentage = RS¹·⁸³ / (RS¹·⁸³ + RA¹·⁸³)。
            高於實際勝率代表「該勝沒勝」(運氣不佳)，反之亦然。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
