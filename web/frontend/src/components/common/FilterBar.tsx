import { cn } from "@/lib/utils";

interface FilterBarProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * Horizontal filter strip — `<FilterBar>` + `<FilterBar.Field label>` pattern,
 * unified across leaderboards / players / predict / games-detail.
 */
export function FilterBar({ className, children }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>
      {children}
    </div>
  );
}

interface FieldProps {
  label?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, className, children }: FieldProps) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <label className="block text-[11px] uppercase tracking-wide font-semibold text-slate-800 mb-1">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

FilterBar.Field = Field;
