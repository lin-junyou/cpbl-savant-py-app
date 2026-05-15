"use client";

/**
 * Stuff+ / Command+ grade table.
 * Average = 100, std dev ≈ 10. Coloured cells: red high, blue low.
 */
import { PITCH_COLORS } from "./StrikeZone";

interface Row {
  pitch_type: string;
  pitches: number;
  stuff_plus: number;
  command_plus: number;
  kph: number;
  spin: number;
}

function gradeColor(v: number): string {
  if (v >= 115) return "#dc2626";
  if (v >= 105) return "#ef4444";
  if (v >= 95) return "#94a3b8";
  if (v >= 85) return "#3b82f6";
  return "#1e3a8a";
}

export function PitchGrades({ rows }: { rows: Row[] }) {
  if (!rows?.length) {
    return <div className="text-slate-700 py-6 text-center">沒有資料</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-xs uppercase text-slate-700 border-b">
        <tr>
          <th className="text-left py-2 pr-2">球種</th>
          <th className="text-right px-2">球數</th>
          <th className="text-right px-2">Avg kph</th>
          <th className="text-right px-2">Spin</th>
          <th className="text-center px-2">Stuff+</th>
          <th className="text-center px-2">Command+</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.pitch_type} className="border-b">
            <td className="py-1.5 pr-2">
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: PITCH_COLORS[r.pitch_type] ?? "#888" }}
                />
                <span className="font-bold" style={{ color: PITCH_COLORS[r.pitch_type] ?? "#0f172a" }}>
                  {r.pitch_type}
                </span>
              </span>
            </td>
            <td className="text-right tabular-nums">{r.pitches}</td>
            <td className="text-right tabular-nums">{r.kph.toFixed(1)}</td>
            <td className="text-right tabular-nums">{r.spin}</td>
            <td className="text-center">
              <span
                className="inline-block min-w-[3rem] px-2 py-0.5 rounded font-bold tabular-nums text-white"
                style={{ background: gradeColor(r.stuff_plus) }}
              >
                {r.stuff_plus.toFixed(0)}
              </span>
            </td>
            <td className="text-center">
              <span
                className="inline-block min-w-[3rem] px-2 py-0.5 rounded font-bold tabular-nums text-white"
                style={{ background: gradeColor(r.command_plus) }}
              >
                {r.command_plus.toFixed(0)}
              </span>
            </td>
          </tr>
        ))}
        <tr>
          <td colSpan={6} className="text-xs text-slate-700 pt-2">
            <b>Stuff+</b>：以聯盟同球種平均球速與轉速為基準（100 = 平均，10 = 一個標準差）。
            <b>Command+</b>：以平均離中心側向距離反推（越靠中心 = 控制越好）。
          </td>
        </tr>
      </tbody>
    </table>
  );
}
