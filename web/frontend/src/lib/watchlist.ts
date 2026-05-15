"use client";

import { useEffect, useState } from "react";

const KEY = "cpbl-savant.watchlist.v1";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = window.localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as string[]) : [];
  } catch {
    return [];
  }
}

function write(v: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
    window.dispatchEvent(new CustomEvent("watchlist-changed"));
  } catch {
    /* noop */
  }
}

export function useWatchlist() {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    setList(read());
    const onChange = () => setList(read());
    window.addEventListener("watchlist-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("watchlist-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const toggle = (pid: string) => {
    const cur = read();
    const next = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid];
    write(next);
  };
  const has = (pid: string) => list.includes(pid);
  const clear = () => write([]);
  return { list, toggle, has, clear };
}
