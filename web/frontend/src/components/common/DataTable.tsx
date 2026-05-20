import { cn } from "@/lib/utils";
import { fmt, type FmtKind } from "@/lib/format";

export interface Column<T> {
  key: string;
  label: React.ReactNode;
  /** Cell renderer. If omitted, the row's value at `key` is rendered using `fmt`. */
  render?: (row: T, rowIndex: number) => React.ReactNode;
  /** Format hint used when `render` is omitted */
  fmt?: FmtKind;
  /** Cell alignment (default "right" for numeric formats, "left" otherwise) */
  align?: "left" | "right" | "center";
  /** Make column header bold/sticky/style */
  className?: string;
  cellClassName?: string;
  /** Header explicit width via tailwind class */
  widthClass?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  rows: T[];
  /** Row key extractor — defaults to row index */
  rowKey?: (row: T, index: number) => React.Key;
  /** Show 1-indexed rank column at the left */
  showRank?: boolean;
  className?: string;
  /** Table size — Savant-style compact rows */
  dense?: boolean;
  /** Hover highlight on rows */
  hoverable?: boolean;
}

/**
 * Generic table with Savant-style header (uppercase, small, slate-700) and
 * tabular-nums numeric cells. Replaces ad-hoc `<thead>` markup across pages.
 */
export function DataTable<T extends Record<string, unknown>>({
  columns, rows, rowKey, showRank, className, dense = true, hoverable = true,
}: DataTableProps<T>) {
  const alignCls = (a: Column<T>["align"], fmtKind?: FmtKind) => {
    const eff = a ?? (fmtKind && fmtKind !== "pct" ? "right" : a);
    if (eff === "right") return "text-right";
    if (eff === "center") return "text-center";
    return "text-left";
  };
  return (
    <table className={cn("w-full text-sm text-slate-900", className)}>
      <thead className="text-xs uppercase text-slate-800 border-b border-slate-300">
        <tr>
          {showRank && <th className="text-left py-2 pr-3 font-semibold">#</th>}
          {columns.map((c) => {
            const headerAlign = c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left";
            return (
              <th
                key={c.key}
                className={cn(
                  "py-2 px-2 font-semibold",
                  headerAlign,
                  c.widthClass,
                  c.className,
                )}
              >
                {c.label}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={rowKey ? rowKey(r, i) : i}
            className={cn(
              "border-b border-slate-100",
              hoverable && "hover:bg-slate-50",
            )}
          >
            {showRank && (
              <td className={cn(dense ? "py-1.5" : "py-2", "pr-3 text-slate-700 tabular-nums")}>
                {i + 1}
              </td>
            )}
            {columns.map((c) => {
              const value = r[c.key];
              const content = c.render
                ? c.render(r, i)
                : c.fmt
                  ? fmt(value, c.fmt)
                  : (value as React.ReactNode);
              const isNumeric = c.fmt && c.fmt !== "pct" && c.fmt !== "pct1" || c.align === "right";
              return (
                <td
                  key={c.key}
                  className={cn(
                    dense ? "py-1.5" : "py-2",
                    "px-2",
                    alignCls(c.align, c.fmt),
                    isNumeric && "tabular-nums",
                    c.cellClassName,
                  )}
                >
                  {content ?? "—"}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
