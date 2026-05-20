import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export unified formatters so existing imports of `@/lib/utils` keep working.
export { fmt, fmtPct, fmtNum, fmtSigned } from "./format";
export type { FmtKind } from "./format";
