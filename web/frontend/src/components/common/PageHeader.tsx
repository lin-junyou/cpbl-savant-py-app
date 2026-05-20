import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  size?: "default" | "lg";
}

/**
 * Standard page header: h1 title + optional subtitle + optional right-side actions.
 * Used across all top-level pages so layout/sizing stays consistent.
 */
export function PageHeader({ title, subtitle, actions, className, size = "default" }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 flex-wrap", className)}>
      <div className="min-w-0">
        <h1
          className={cn(
            "font-bold text-slate-900 tracking-tight",
            size === "lg" ? "text-3xl" : "text-2xl",
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <div className="text-sm text-slate-800 mt-1">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

interface SectionProps {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Lightweight section wrapper for in-page subsections (h2 + content) */
export function Section({ title, actions, className, children }: SectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
