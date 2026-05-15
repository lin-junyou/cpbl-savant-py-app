"use client";

/**
 * Per-pitch-type physics table:
 *   Extension (m), Release Speed, Zone Speed (at plate), Velocity Drop,
 *   Vertical Approach Angle, Horizontal Approach Angle.
 */
import { PITCH_COLORS } from "./StrikeZone";

interface Row {
  auto_pitch_type: string;
  pitches: number;
  ext_avg: number | null;
  ext_max: number | null;
  rel_kph: number | null;
  zone_kph: number | null;
  velo_drop: number | null;
  vaa_avg: number | null;
  haa_avg: number | null;
}

export function PitchPhysics({ rows }: { rows: Row[] }) {
  if (!rows?.length) {
    return <div className="text-slate-700 py-6 text-center">沒有資料</div>;
  }
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-700 border-b">
            <tr>
              <th className="text-left py-2 pr-2">球種</th>
              <th className="text-right px-2">Ext (m)</th>
              <th className="text-right px-2">Rel kph</th>
              <th className="text-right px-2">Zone kph</th>
              <th className="text-right px-2">Δ kph</th>
              <th className="text-right px-2">VAA °</th>
              <th className="text-right px-2">HAA °</th>
              <th className="text-right px-2">球數</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.auto_pitch_type} className="border-b">
                <td className="py-1.5 pr-2">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ background: PITCH_COLORS[r.auto_pitch_type] ?? "#888" }}
                    />
                    <span
                      className="font-bold"
                      style={{ color: PITCH_COLORS[r.auto_pitch_type] ?? "#0f172a" }}
                    >
                      {r.auto_pitch_type}
                    </span>
                  </span>
                </td>
                <td className="text-right tabular-nums">
                  {r.ext_avg?.toFixed(2) ?? "—"}
                </td>
                <td className="text-right tabular-nums">
                  {r.rel_kph?.toFixed(1) ?? "—"}
                </td>
                <td className="text-right tabular-nums">
                  {r.zone_kph?.toFixed(1) ?? "—"}
                </td>
                <td className="text-right tabular-nums text-slate-700">
                  {r.velo_drop?.toFixed(1) ?? "—"}
                </td>
                <td className="text-right tabular-nums">
                  {r.vaa_avg?.toFixed(2) ?? "—"}
                </td>
                <td className="text-right tabular-nums">
                  {r.haa_avg?.toFixed(2) ?? "—"}
                </td>
                <td className="text-right tabular-nums text-slate-500">{r.pitches}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-700">
        <b>Ext</b> = 釋球延伸（球出手時離本壘的距離；越大越好，「壓縮投打距離」）。
        <b>Δ kph</b> = 球速衰減（rel − zone；速球的 carry 與 4-seam rising 效果反相關）。
        <b>VAA</b> = vertical approach angle（負值越接近 0 表示平直「rising」效果，4-seam 越平越難打）。
        <b>HAA</b> = horizontal approach angle（投手側向釋球差異 + magnus 影響）。
      </p>
    </div>
  );
}
