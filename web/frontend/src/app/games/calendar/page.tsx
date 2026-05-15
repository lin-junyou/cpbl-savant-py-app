"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

export default function CalendarPage() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(5); // 1-indexed

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const games = useQuery({
    queryKey: ["calendar", start, end],
    queryFn: () => api.schedule({ start, end, limit: 500 }),
  });

  const grid = useMemo(() => {
    // Group games by date
    const byDate: Record<string, typeof games.data> = {};
    games.data?.forEach((g) => {
      (byDate[g.date] ??= []).push(g);
    });
    // Build grid: weeks of 7 days, starting from Sunday before month start
    const firstDow = new Date(year, month - 1, 1).getDay();
    const cells: Array<{ date: string | null; games: NonNullable<typeof games.data> }> = [];
    for (let i = 0; i < firstDow; i++) cells.push({ date: null, games: [] });
    for (let d = 1; d <= lastDay; d++) {
      const ds = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ date: ds, games: (byDate[ds] ?? []) as NonNullable<typeof games.data> });
    }
    while (cells.length % 7) cells.push({ date: null, games: [] });
    const weeks: Array<typeof cells> = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [games.data, year, month, lastDay]);

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">賽程行事曆</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>← 上月</Button>
          <span className="text-lg font-semibold text-slate-900 min-w-[120px] text-center">
            {year} {MONTHS[month - 1]}
          </span>
          <Button variant="outline" size="sm" onClick={nextMonth}>下月 →</Button>
          <Link href="/games" className="ml-3 text-xs text-blue-700 hover:underline">
            清單視圖 →
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <table className="w-full table-fixed">
            <thead>
              <tr>
                {["日", "一", "二", "三", "四", "五", "六"].map((w, i) => (
                  <th
                    key={w}
                    className={`pb-2 text-xs font-semibold ${i === 0 || i === 6 ? "text-red-600" : "text-slate-700"}`}
                  >
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((week, wi) => (
                <tr key={wi}>
                  {week.map((c, di) => (
                    <td
                      key={di}
                      className="align-top h-24 border border-slate-200 p-1.5"
                    >
                      {c.date ? (
                        <>
                          <div
                            className={`text-xs font-semibold mb-0.5 ${di === 0 || di === 6 ? "text-red-600" : "text-slate-700"}`}
                          >
                            {Number(c.date.slice(-2))}
                          </div>
                          <div className="space-y-0.5">
                            {c.games.slice(0, 3).map((g) => (
                              <Link
                                key={g.game_id}
                                href={`/games/${g.game_id}`}
                                className="block text-[10px] leading-tight bg-slate-50 hover:bg-slate-100 rounded px-1 py-0.5 truncate"
                                title={`${g.visiting_team_name} @ ${g.home_team_name}`}
                              >
                                <span className="text-slate-700">
                                  {g.visiting_team_name?.replace("二軍", "")}
                                </span>
                                {g.visiting_score != null && g.home_score != null && (
                                  <span className="font-bold text-slate-900 mx-0.5">
                                    {g.visiting_score}-{g.home_score}
                                  </span>
                                )}
                                <span className="text-slate-700">
                                  {g.home_team_name?.replace("二軍", "")}
                                </span>
                              </Link>
                            ))}
                            {c.games.length > 3 && (
                              <div className="text-[10px] text-slate-500">
                                +{c.games.length - 3}…
                              </div>
                            )}
                          </div>
                        </>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
