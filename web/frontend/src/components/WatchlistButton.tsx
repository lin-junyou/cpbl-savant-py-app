"use client";

import { Star } from "lucide-react";
import { useWatchlist } from "@/lib/watchlist";
import { Button } from "./ui/button";

export function WatchlistButton({ pid }: { pid: string }) {
  const { has, toggle } = useWatchlist();
  const active = has(pid);
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={() => toggle(pid)}
      className={
        active
          ? "bg-amber-400 text-slate-900 hover:bg-amber-300 border-amber-400"
          : ""
      }
    >
      <Star
        className={`w-4 h-4 mr-1 ${active ? "fill-current" : ""}`}
      />
      {active ? "已收藏" : "收藏"}
    </Button>
  );
}
