"use client";

/**
 * Recent game-by-game log table for a player. Pitcher and hitter share the
 * component but show different columns.
 */
import Link from "next/link";

type Row = Record<string, number | string | null>;

interface Props {
  rows: Row[];
  role: "pitcher" | "hitter";
}

const PITCHER_COLS: Array<[string, string]> = [
  ["date", "日期"],
  ["team_name", "球隊"],
  ["role_type", "角色"],
  ["inning_pitched_cnt", "IP"],
  ["plate_appearances", "PA"],
  ["hitting_cnt", "H"],
  ["home_run_cnt", "HR"],
  ["bases_on_balls_cnt", "BB"],
  ["strike_out_cnt", "K"],
  ["earned_run_cnt", "ER"],
  ["pitch_cnt", "球數"],
  ["era", "ERA"],
  ["whip", "WHIP"],
];

const HITTER_COLS: Array<[string, string]> = [
  ["date", "日期"],
  ["team_name", "球隊"],
  ["lineup", "棒次"],
  ["defend_station", "守"],
  ["plate_appearances", "PA"],
  ["hitting_cnt", "AB"],
  ["hit_cnt", "H"],
  ["two_base_hit_cnt", "2B"],
  ["three_base_hit_cnt", "3B"],
  ["home_run_cnt", "HR"],
  ["run_batted_in_cnt", "RBI"],
  ["bases_on_balls_cnt", "BB"],
  ["strike_out_cnt", "K"],
  ["score_cnt", "R"],
];

function fmt(v: number | string | null): string {
  if (v == null || v === "") return "—";
  return String(v);
}

export function GameLogs({ rows, role }: Props) {
  if (!rows.length) {
    return <div className="text-slate-700 py-6 text-center">沒有比賽紀錄</div>;
  }
  const cols = role === "pitcher" ? PITCHER_COLS : HITTER_COLS;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-700 border-b">
          <tr>
            {cols.map(([, label]) => (
              <th
                key={label}
                className={
                  label === "日期" || label === "球隊" || label === "角色"
                    ? "text-left py-2 px-2"
                    : "text-right py-2 px-2"
                }
              >
                {label}
              </th>
            ))}
            <th className="text-right py-2 px-2">比賽</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b hover:bg-slate-50">
              {cols.map(([key, label]) => (
                <td
                  key={key}
                  className={
                    label === "日期" || label === "球隊" || label === "角色"
                      ? "py-1.5 px-2"
                      : "py-1.5 px-2 text-right tabular-nums"
                  }
                >
                  {fmt(r[key])}
                </td>
              ))}
              <td className="py-1.5 px-2 text-right">
                <Link
                  href={`/games/${r.game_id}`}
                  className="text-blue-700 hover:underline text-xs"
                >
                  {String(r.game_id ?? "—").replace(/^.*-/, "#")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
