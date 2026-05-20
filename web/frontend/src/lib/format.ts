// Unified number / percent / value formatting helpers.
// Replaces ad-hoc fmt() implementations previously scattered across pages.

export type FmtKind =
  | "pct"   // 0.123 -> "12.3%"
  | "pct1"  // alias of pct (legacy)
  | "f3"    // 0.123456 -> "0.123"
  | "f2"
  | "f1"
  | "f0"
  | "int"   // rounded + locale grouping
  | "0";    // legacy alias of int

export function fmt(value: unknown, kind?: FmtKind | string): string {
  if (value == null || value === "") return "—";
  const v = Number(value);
  if (Number.isNaN(v)) return String(value);
  switch (kind) {
    case "pct":
    case "pct1":
      return (v * 100).toFixed(1) + "%";
    case "f3":
      return v.toFixed(3);
    case "f2":
      return v.toFixed(2);
    case "f1":
      return v.toFixed(1);
    case "f0":
    case "int":
    case "0":
      return Math.round(v).toLocaleString();
    default:
      return String(value);
  }
}

export function fmtPct(v: number | null | undefined, d = 1): string {
  if (v == null || Number.isNaN(v as number)) return "—";
  return ((v as number) * 100).toFixed(d) + "%";
}

export function fmtNum(v: number | null | undefined, d = 3): string {
  if (v == null || Number.isNaN(v as number)) return "—";
  return (v as number).toFixed(d);
}

// Signed value with leading "+" for positives. Useful for run-diff, delta tables.
export function fmtSigned(v: number | null | undefined, d = 0): string {
  if (v == null || Number.isNaN(v as number)) return "—";
  const n = v as number;
  const s = d === 0 ? Math.round(n).toString() : n.toFixed(d);
  return n > 0 ? `+${s}` : s;
}
