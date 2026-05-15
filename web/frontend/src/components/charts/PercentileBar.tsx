"use client";

/**
 * Baseball Savant-style percentile bar.
 *
 *   [Label]   ▮▮▮▮▮▮▮▮▮▮  ●68  [raw value]
 *
 * The bar uses a continuous diverging gradient (blue → light → red) so
 * 50th-percentile lands on neutral grey. The marker circle is filled with
 * the gradient colour at the same percentile and labelled with the rank.
 */
interface Props {
  label: string;
  /** Percentile rank, 0–100. */
  pr: number;
  /** Raw stat value to display on the right (already formatted). */
  value?: string;
}

// Savant's gradient endpoints (rough match to their site)
const RED = [220, 56, 38];   // top
const NEUTRAL = [228, 226, 220];
const BLUE = [76, 124, 196]; // bottom

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function colorAt(pr: number): string {
  // 0..50 = blue → neutral, 50..100 = neutral → red
  let c: number[];
  if (pr <= 50) {
    const t = pr / 50;
    c = BLUE.map((b, i) => lerp(b, NEUTRAL[i], t));
  } else {
    const t = (pr - 50) / 50;
    c = NEUTRAL.map((n, i) => lerp(n, RED[i], t));
  }
  return `rgb(${c.map((v) => Math.round(v)).join(",")})`;
}

export function PercentileBar({ label, pr, value }: Props) {
  const clamped = Math.max(0, Math.min(100, pr));
  const markerColor = colorAt(clamped);
  // Text color of the marker depends on background brightness for legibility
  const isExtreme = clamped <= 25 || clamped >= 75;
  const textColor = isExtreme ? "#ffffff" : "#1f2937";
  return (
    <div className="grid grid-cols-[120px_1fr_56px] items-center gap-3 py-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-right text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <div className="relative h-2 rounded-full overflow-visible bg-gradient-to-r from-[rgb(76,124,196)] via-[rgb(228,226,220)] to-[rgb(220,56,38)]">
        {/* Tick marks at quartiles */}
        {[25, 50, 75].map((p) => (
          <span
            key={p}
            className="absolute top-1/2 -translate-y-1/2 h-1.5 w-px bg-white/60"
            style={{ left: `${p}%` }}
          />
        ))}
        {/* Marker circle */}
        <span
          className="absolute -top-2 -translate-x-1/2 flex items-center justify-center h-6 w-6 rounded-full border-2 border-white shadow-sm text-[11px] font-bold tabular-nums"
          style={{
            left: `${clamped}%`,
            background: markerColor,
            color: textColor,
          }}
        >
          {Math.round(clamped)}
        </span>
      </div>
      <span className="text-sm font-bold tabular-nums text-right text-slate-900 dark:text-slate-100">
        {value ?? ""}
      </span>
    </div>
  );
}
