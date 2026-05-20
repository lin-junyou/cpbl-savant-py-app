import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: React.ReactNode;
  /** Right-side actions in the header (filters, toggles, links) */
  actions?: React.ReactNode;
  /** Footer text rendered below the content with smaller, lighter styling */
  footer?: React.ReactNode;
  /** Removes default content padding (useful for full-bleed charts/tables) */
  flush?: boolean;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

/**
 * Savant-style content panel — Card + CardHeader + CardTitle scaffolding
 * unified into one component so every section across the app has the same
 * spacing, title weight, and slate-900 title color.
 */
export function SectionCard({
  title, actions, footer, flush, className, contentClassName, children,
}: SectionCardProps) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          {title && (
            <CardTitle className="text-base text-slate-900 font-semibold">
              {title}
            </CardTitle>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent
        className={cn(flush && "p-0", "overflow-x-auto", contentClassName)}
      >
        {children}
        {footer && (
          <div className="mt-3 text-xs text-slate-800 leading-relaxed">{footer}</div>
        )}
      </CardContent>
    </Card>
  );
}
