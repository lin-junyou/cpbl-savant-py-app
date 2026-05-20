import { cn } from "@/lib/utils";

interface BaseProps {
  className?: string;
  /** "page"=full-page tall, "inline"=card body, "tight"=compact */
  size?: "page" | "inline" | "tight";
}

interface LoadingProps extends BaseProps {
  text?: string;
}

const PAD = {
  page: "py-16 text-center",
  inline: "py-12 text-center",
  tight: "py-6 text-center",
} as const;

export function LoadingState({ text = "載入中…", size = "inline", className }: LoadingProps) {
  return (
    <div className={cn(PAD[size], "text-slate-800 text-sm", className)} role="status" aria-live="polite">
      <span className="inline-flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-slate-500 animate-pulse" />
        {text}
      </span>
    </div>
  );
}

interface EmptyProps extends BaseProps {
  text?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ text = "無資料", size = "inline", className, icon, action }: EmptyProps) {
  return (
    <div className={cn(PAD[size], "text-slate-800 text-sm", className)}>
      {icon && <div className="mb-2 flex justify-center text-slate-500">{icon}</div>}
      <div>{text}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

interface ErrorProps extends BaseProps {
  error?: unknown;
  text?: string;
}

export function ErrorState({ error, text = "載入錯誤", size = "inline", className }: ErrorProps) {
  const msg =
    error instanceof Error ? error.message :
    typeof error === "string" ? error :
    error != null ? String(error) :
    "";
  return (
    <div className={cn(PAD[size], "text-sm", className)}>
      <div className="text-red-700 font-semibold">{text}</div>
      {msg && <div className="text-xs text-slate-800 mt-1 font-mono">{msg}</div>}
    </div>
  );
}

// QueryGate: wraps a react-query-like result and renders the right state.
// Usage: <QueryGate query={q}>{(data) => <Chart data={data} />}</QueryGate>
interface QueryLike<T> {
  isLoading?: boolean;
  isPending?: boolean;
  error?: unknown;
  data?: T | undefined;
}

interface GateProps<T> extends BaseProps {
  query: QueryLike<T>;
  empty?: (data: T) => boolean;
  emptyText?: string;
  loadingText?: string;
  children: (data: T) => React.ReactNode;
}

export function QueryGate<T>({
  query, empty, emptyText, loadingText, size = "inline", children,
}: GateProps<T>) {
  if (query.error) return <ErrorState error={query.error} size={size} />;
  if (query.isLoading || query.isPending || query.data === undefined)
    return <LoadingState text={loadingText} size={size} />;
  if (empty && empty(query.data)) return <EmptyState text={emptyText} size={size} />;
  return <>{children(query.data)}</>;
}
