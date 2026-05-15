"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <div className="text-6xl">⚾️</div>
      <h2 className="text-2xl font-bold text-slate-900">出了點狀況</h2>
      <p className="text-slate-700 max-w-lg text-center text-sm">
        {error.message || "頁面載入失敗，可能是後端 API 沒啟動或資料尚未建好。"}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} variant="default">重試</Button>
        <Button onClick={() => (window.location.href = "/")} variant="outline">
          回首頁
        </Button>
      </div>
    </div>
  );
}
