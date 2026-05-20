"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

/**
 * Hook that syncs a tab value with a URL query param so tabs are bookmarkable
 * and survive shares / refresh / back-forward.
 *
 *   const [tab, setTab] = useTabParam("overview", "tab");
 *
 *   <Tabs value={tab} onValueChange={setTab}>...</Tabs>
 */
export function useTabParam(defaultValue: string, key = "tab"): [string, (v: string) => void] {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = search.get(key) ?? defaultValue;

  const setTab = useCallback(
    (v: string) => {
      const params = new URLSearchParams(search.toString());
      if (v === defaultValue) params.delete(key);
      else params.set(key, v);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [search, router, pathname, defaultValue, key],
  );

  return [current, setTab];
}
