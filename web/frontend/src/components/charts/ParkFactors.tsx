"use client";

/**
 * Park Factors bar chart — diverging bars centred on 100.
 * Above 100 = the park favours that outcome vs league average.
 */

interface Props {
  factors: Record<string, number>;
  ownN: number;
  otherN: number;
}

const LABELS: Record<string, string> = {
  HR: "全壘打",
  "3B": "三壘安打",
  "2B": "二壘安打",
  "1B": "一壘安打",
  BB: "保送",
  K_called: "看三振",
  K_swing: "揮三振",
  EV_avg: "平均球速",
  Dist_avg: "平均距離",
};

const ORDER = ["HR", "3B", "2B", "1B", "EV_avg", "Dist_avg", "BB", "K_called", "K_swing"];

export function ParkFactors({ factors, ownN, otherN }: Props) {
  const max = Math.max(
    50,
    ...Object.values(factors).map((v) => Math.abs(v - 100)),
  );
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-700">
        本場 {ownN.toLocaleString()} 球 vs 其他球場 {otherN.toLocaleString()} 球
      </div>
      <div className="space-y-1.5">
        {ORDER.filter((k) => k in factors).map((k) => {
          const v = factors[k];
          const delta = v - 100;
          const widthPct = Math.min(48, (Math.abs(delta) / max) * 48);
          const color = delta > 5 ? "#dc2626" : delta < -5 ? "#2563eb" : "#94a3b8";
          return (
            <div
              key={k}
              className="grid grid-cols-[120px_1fr_60px] items-center gap-2 text-sm"
            >
              <span className="text-right pr-2 text-slate-700">
                {LABELS[k] ?? k}
              </span>
              <div className="relative h-6 bg-slate-100 rounded">
                <div
                  className="absolute top-0 bottom-0 border-r border-slate-400"
                  style={{ left: "50%", width: 1 }}
                />
                <div
                  className="absolute top-0 bottom-0 rounded"
                  style={{
                    background: color,
                    width: `${widthPct}%`,
                    left: delta >= 0 ? "50%" : `${50 - widthPct}%`,
                  }}
                />
                <span
                  className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums"
                  style={{ color: "#0f172a" }}
                >
                  {v.toFixed(1)}
                </span>
              </div>
              <span
                className="tabular-nums text-right text-xs font-semibold"
                style={{ color }}
              >
                {delta > 0 ? "+" : ""}
                {delta.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
