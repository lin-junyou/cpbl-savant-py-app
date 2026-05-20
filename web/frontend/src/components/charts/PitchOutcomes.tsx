"use client";

/**
 * Per-pitch-type performance table for pitchers (Savant pitch-arsenal style).
 *
 *   • Inline summary header — "Pitcher relies on N pitches: FF (44.7%),
 *     SL (26.7%) ..." with each pitch coloured by Savant's official pitch
 *     palette (matches the look of the Statcast Pitch Arsenal section).
 *   • Detailed table below.
 */
import type { PitchStat } from "@/lib/api";
import { PITCH_COLORS } from "./StrikeZone";

interface Props {
  stats: PitchStat[];
  /** Optional — accepted for backward compat, no longer displayed (title says it). */
  playerName?: string;
}

const ZH_PITCH_NAME: Record<string, string> = {
  "Four-Seam":   "四縫線速球",
  "Two-Seam":    "二縫線速球",
  "Sinker":      "伸卡球",
  "Cutter":      "卡特球",
  "Slider":      "滑球",
  "Sweeper":     "Sweeper",
  "Curveball":   "曲球",
  "Changeup":    "變速球",
  "Splitter":    "指叉球",
  "Knuckleball": "蝴蝶球",
};

export function PitchOutcomes({ stats }: Props) {
  if (!stats?.length) {
    return <div className="text-slate-700 py-8 text-center">沒有資料</div>;
  }
  return (
    <div className="space-y-4">
      {/* Compact pitch-mix legend: chips with pitch dot + name + usage% */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-sm">
        {stats.map((s) => {
          const color = PITCH_COLORS[s.auto_pitch_type] ?? "#888";
          return (
            <span key={s.auto_pitch_type} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <b style={{ color }}>
                {ZH_PITCH_NAME[s.auto_pitch_type] ?? s.auto_pitch_type}
              </b>
              <span className="text-slate-600 tabular-nums">{s.usage_pct.toFixed(1)}%</span>
            </span>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-700 border-b">
            <tr>
              <th className="text-left py-2 pr-2">球種</th>
              <th className="text-right px-2">使用%</th>
              <th className="text-right px-2">球數</th>
              <th className="text-right px-2">揮棒%</th>
              <th className="text-right px-2">揮空/揮</th>
              <th className="text-right px-2">Avg kph</th>
              <th className="text-right px-2">Max kph</th>
              <th className="text-right px-2">Spin</th>
              <th className="text-right px-2">擊入場</th>
              <th className="text-right px-2">安打</th>
              <th className="text-right px-2">HR</th>
              <th className="text-right px-2">EV avg</th>
              <th className="text-right px-2">LA avg</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const color = PITCH_COLORS[s.auto_pitch_type] ?? "#888";
              return (
                <tr key={s.auto_pitch_type} className="border-b">
                  <td className="py-1.5 pr-2">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ background: color }}
                      />
                      <span className="font-bold" style={{ color }}>
                        {ZH_PITCH_NAME[s.auto_pitch_type] ?? s.auto_pitch_type}
                      </span>
                    </span>
                  </td>
                  <td className="text-right tabular-nums">
                    {s.usage_pct.toFixed(1)}%
                  </td>
                  <td className="text-right tabular-nums">{s.pitches}</td>
                  <td className="text-right tabular-nums">
                    {s.swing_pct.toFixed(1)}%
                  </td>
                  <td className="text-right tabular-nums">
                    {s.whiff_per_swing.toFixed(1)}%
                  </td>
                  <td className="text-right tabular-nums">
                    {s.avg_kph?.toFixed(1) ?? "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {s.max_kph?.toFixed(1) ?? "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {s.avg_spin?.toFixed(0) ?? "—"}
                  </td>
                  <td className="text-right tabular-nums">{s.in_play}</td>
                  <td className="text-right tabular-nums">{s.hits}</td>
                  <td className="text-right tabular-nums">{s.home_runs}</td>
                  <td className="text-right tabular-nums">
                    {s.avg_ev?.toFixed(1) ?? "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {s.avg_la?.toFixed(1) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
