import { cn } from "@/lib/utils";
import { fmt, type FmtKind } from "@/lib/format";

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Optional formatting hint when `value` is a raw number */
  fmt?: FmtKind;
  /** Unit appended after the value (e.g. "kph", "m", "°") */
  unit?: string;
  /** Tone — affects accent border color */
  tone?: "default" | "red" | "blue" | "green";
  /** Render style: "tile" = bordered card-ish, "inline" = bordered-left strip */
  variant?: "tile" | "inline";
  hint?: React.ReactNode;
  className?: string;
}

const TONE_BORDER: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "border-slate-300",
  red: "border-red-500",
  blue: "border-blue-500",
  green: "border-green-500",
};

/**
 * Savant-style stat tile.
 *
 * - "tile" variant   → bordered card with big number (used for hero stat grids)
 * - "inline" variant → compact left-border strip (used inside section panels)
 */
export function StatCard({
  label, value, fmt: kind, unit, tone = "default", variant = "tile", hint, className,
}: StatCardProps) {
  const display = typeof value === "number" || (kind && value != null)
    ? fmt(value, kind)
    : value;

  if (variant === "inline") {
    return (
      <div className={cn("border-l-2 pl-3", TONE_BORDER[tone], className)}>
        <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-800">{label}</div>
        <div className="font-bold text-base tabular-nums text-slate-900">
          {display}
          {unit && <span className="ml-0.5 text-xs text-slate-700 font-normal">{unit}</span>}
        </div>
        {hint && <div className="text-[10px] text-slate-700 mt-0.5">{hint}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-slate-200 bg-white px-4 py-3",
        className,
      )}
    >
      <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-800">{label}</div>
      <div className="text-2xl font-bold tabular-nums text-slate-900 mt-0.5">
        {display}
        {unit && <span className="ml-1 text-sm text-slate-700 font-normal">{unit}</span>}
      </div>
      {hint && <div className="text-xs text-slate-700 mt-1">{hint}</div>}
    </div>
  );
}

interface StatGridProps {
  /** Each item turns into a StatCard. Use this when rendering a static list. */
  items: Array<{
    label: React.ReactNode;
    value: React.ReactNode;
    fmt?: FmtKind;
    unit?: string;
    tone?: StatCardProps["tone"];
    hint?: React.ReactNode;
  }>;
  variant?: StatCardProps["variant"];
  /** Columns at each breakpoint (matches tailwind grid-cols-{n}) */
  cols?: { base?: number; sm?: number; md?: number; lg?: number };
  className?: string;
}

const COL_CLS: Record<number, string> = {
  1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4",
  5: "grid-cols-5", 6: "grid-cols-6", 7: "grid-cols-7", 8: "grid-cols-8",
};
const SM_CLS: Record<number, string> = {
  1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4",
  5: "sm:grid-cols-5", 6: "sm:grid-cols-6",
};
const MD_CLS: Record<number, string> = {
  1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4",
  5: "md:grid-cols-5", 6: "md:grid-cols-6", 7: "md:grid-cols-7", 8: "md:grid-cols-8",
};
const LG_CLS: Record<number, string> = {
  1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4",
  5: "lg:grid-cols-5", 6: "lg:grid-cols-6", 7: "lg:grid-cols-7", 8: "lg:grid-cols-8",
};

export function StatGrid({
  items, variant = "tile",
  cols = { base: 2, sm: 3, md: 6 },
  className,
}: StatGridProps) {
  return (
    <div
      className={cn(
        "grid gap-3",
        cols.base && COL_CLS[cols.base],
        cols.sm && SM_CLS[cols.sm],
        cols.md && MD_CLS[cols.md],
        cols.lg && LG_CLS[cols.lg],
        className,
      )}
    >
      {items.map((it, i) => (
        <StatCard key={i} {...it} variant={variant} />
      ))}
    </div>
  );
}
