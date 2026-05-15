"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SearchBox } from "./SearchBox";

const ITEMS = [
  { href: "/", label: "首頁" },
  { href: "/players", label: "球員" },
  { href: "/teams", label: "球隊" },
  { href: "/standings", label: "戰績" },
  { href: "/matchup", label: "對戰" },
  { href: "/leaderboards", label: "排行榜" },
  { href: "/compare", label: "比較" },
  { href: "/predict", label: "預測" },
  { href: "/stadiums", label: "球場" },
  { href: "/games", label: "賽程" },
  { href: "/watchlist", label: "⭐" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-slate-900/95 text-slate-100 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 gap-3">
        <Link
          href="/"
          className="font-bold text-lg tracking-tight mr-2 text-slate-100"
        >
          CPBL <span className="text-red-500">Savant</span>
        </Link>
        <nav className="flex gap-1 flex-1">
          {ITEMS.map((it) => {
            const active =
              it.href === "/" ? path === "/" : path?.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  active
                    ? "bg-slate-700 font-medium text-white"
                    : "text-slate-300 hover:text-white hover:bg-slate-800",
                )}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
        <SearchBox />
      </div>
    </header>
  );
}
