"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search } from "lucide-react";

export function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounced query
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  const results = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.players({ q: debounced }),
    enabled: debounced.trim().length > 0,
  });

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative w-72">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="搜尋球員姓名..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.data && results.data.length > 0) {
              router.push(`/players/${results.data[0].player_id}`);
              setOpen(false);
              setQ("");
            }
          }}
          className="w-full h-9 pl-8 pr-3 text-sm bg-slate-800 text-slate-100 placeholder-slate-400 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      {open && q && (
        <div className="absolute top-full mt-1 left-0 right-0 max-h-96 overflow-y-auto bg-white border rounded-md shadow-lg z-50">
          {results.isLoading ? (
            <div className="p-3 text-sm text-slate-700">搜尋中…</div>
          ) : results.data && results.data.length > 0 ? (
            results.data.slice(0, 12).map((p) => (
              <button
                key={p.player_id}
                onClick={() => {
                  router.push(`/players/${p.player_id}`);
                  setOpen(false);
                  setQ("");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 text-left text-sm"
              >
                <div className="w-8 h-8 rounded overflow-hidden bg-slate-200 flex-shrink-0">
                  {p.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.image_url}
                      alt={p.name ?? ""}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-slate-900">
                    {p.name} <span className="text-xs text-slate-500">#{p.jersey_number}</span>
                  </div>
                  <div className="text-xs text-slate-700 truncate">
                    {p.team_name} · {p.position_name}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-3 text-sm text-slate-700">沒有結果</div>
          )}
        </div>
      )}
    </div>
  );
}
