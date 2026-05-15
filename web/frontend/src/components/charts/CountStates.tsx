"use client";

/**
 * Pitch usage by ball/strike count situation.
 *
 *   • Stacked horizontal bars (one per count state) with each segment
 *     coloured by pitch type and labelled with usage %.
 */
import { PITCH_COLORS } from "./StrikeZone";

interface Props {
  data: Record<string, Record<string, number>>;
}

const STATE_LABEL: Record<string, string> = {
  ahead: "領先球數 (0-1, 0-2, 1-2)",
  even: "平分球數 (0-0, 1-1, 2-2)",
  behind: "落後球數 (2-0, 3-0, 3-1)",
  two_strk: "兩好球",
};

const STATE_ORDER = ["ahead", "even", "behind", "two_strk"];

export function CountStates({ data }: Props) {
  const allTypes = Array.from(new Set(
    Object.values(data).flatMap((m) => Object.keys(m)),
  ));
  return (
    <div className="space-y-3">
      {STATE_ORDER.map((st) => {
        const m = data[st];
        if (!m) return (
          <div key={st}>
            <div className="text-xs font-semibold text-slate-700 mb-1">
              {STATE_LABEL[st]} <span className="text-slate-500">(無資料)</span>
            </div>
          </div>
        );
        const total = Object.values(m).reduce((s, v) => s + v, 0);
        const sorted = Object.entries(m).sort((a, b) => b[1] - a[1]);
        return (
          <div key={st}>
            <div className="text-xs font-semibold text-slate-900 mb-1">
              {STATE_LABEL[st]} <span className="text-slate-500">— 共 {total} 球</span>
            </div>
            <div className="flex h-7 rounded overflow-hidden border border-slate-300">
              {sorted.map(([pt, v]) => {
                const pct = (v / total) * 100;
                return (
                  <div
                    key={pt}
                    style={{
                      width: `${pct}%`,
                      background: PITCH_COLORS[pt] ?? "#888",
                    }}
                    className="flex items-center justify-center text-[10px] text-white font-bold"
                    title={`${pt}: ${v} (${pct.toFixed(1)}%)`}
                  >
                    {pct >= 8 ? `${pt.slice(0, 4)} ${pct.toFixed(0)}%` : ""}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-200">
        {allTypes.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 text-xs">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: PITCH_COLORS[t] ?? "#888" }}
            />
            <span className="text-slate-700">{t}</span>
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-700">
        投手在不同球數狀況下的球種選擇 — 兩好球時通常增加 breaking ball 比例去搶 K。
      </p>
    </div>
  );
}
