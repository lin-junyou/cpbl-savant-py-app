"use client";

/**
 * Per-pitch-type Run Value bar chart.
 *
 *   • Horizontal bars centred on 0 (positive = good for pitcher / bad for
 *     batter, since we sign-flip pitcher RV).
 *   • Color = pitch type (Savant palette).
 *   • Numeric label = absolute Run Value (in runs) and RV / 100 pitches.
 */
import { PITCH_COLORS } from "./StrikeZone";

interface Row {
  pitch_type: string;
  pitches: number;
  run_value: number;
  rv_per_100: number;
}

export function RunValue({
  rows,
  role,
}: {
  rows: Row[];
  role: "pitcher" | "hitter";
}) {
  if (!rows.length) {
    return <div className="text-slate-700 py-6 text-center">沒有資料</div>;
  }
  const max = Math.max(...rows.map((r) => Math.abs(r.run_value)), 1);
  const goodLabel = role === "pitcher" ? "對投手有利" : "對打者有利";
  const badLabel = role === "pitcher" ? "對投手不利" : "對打者不利";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[140px_1fr_120px] items-center text-xs uppercase text-slate-700 border-b pb-1">
        <span className="text-right pr-2">球種</span>
        <span className="text-center">Run Value</span>
        <span className="text-right">RV/100</span>
      </div>
      {rows.map((r) => {
        const positive = r.run_value >= 0;
        const widthPct = (Math.abs(r.run_value) / max) * 50;
        const color = PITCH_COLORS[r.pitch_type] ?? "#888";
        return (
          <div
            key={r.pitch_type}
            className="grid grid-cols-[140px_1fr_120px] items-center text-sm gap-1"
          >
            <span className="text-right pr-2 font-semibold" style={{ color }}>
              {r.pitch_type}{" "}
              <span className="text-xs font-normal text-slate-500">
                · {r.pitches}
              </span>
            </span>
            <div className="relative h-5 bg-slate-100 rounded">
              <div
                className="absolute top-0 bottom-0"
                style={{ left: "50%", width: 1, background: "#475569" }}
              />
              <div
                className="absolute top-0 bottom-0 rounded"
                style={{
                  background: positive ? color : "#94a3b8",
                  width: `${widthPct}%`,
                  left: positive ? "50%" : `${50 - widthPct}%`,
                }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums"
                style={{ color: "#0f172a" }}
              >
                {r.run_value.toFixed(2)}
              </div>
            </div>
            <span className="text-right tabular-nums font-semibold text-slate-900">
              {r.rv_per_100.toFixed(2)}
            </span>
          </div>
        );
      })}
      <div className="text-xs text-slate-700 mt-2">
        ➜ {goodLabel}（正值，越大越好）　/　← {badLabel}（負值，越小越差）
      </div>
    </div>
  );
}
