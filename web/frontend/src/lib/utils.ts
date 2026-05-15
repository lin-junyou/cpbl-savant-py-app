import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(v: number | null | undefined, d = 3): string {
  if (v == null || isNaN(v as number)) return "—";
  return (v as number).toFixed(d);
}

export function fmtPct(v: number | null | undefined, d = 1): string {
  if (v == null || isNaN(v as number)) return "—";
  return ((v as number) * 100).toFixed(d) + "%";
}
