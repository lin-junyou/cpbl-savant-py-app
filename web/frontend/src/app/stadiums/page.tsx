"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, LoadingState } from "@/components/common";
import { fmtNum } from "@/lib/format";

export default function StadiumsPage() {
  const stadiums = useQuery({ queryKey: ["stadiums"], queryFn: api.stadiums });
  return (
    <div className="space-y-4">
      <PageHeader
        title="球場分析"
        subtitle={`${stadiums.data?.length ?? "—"} 座球場（Trackman 資料）`}
      />
      {stadiums.isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {stadiums.data?.map((s) => (
            <Link
              key={s.field_name + s.field_no}
              href={`/stadiums/${encodeURIComponent(s.field_name)}`}
            >
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">{s.field_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div>球路: <b>{s.pitches.toLocaleString()}</b></div>
                  <div>擊球: <b>{s.batted_balls.toLocaleString()}</b></div>
                  <div className="text-slate-700 text-xs">
                    Avg EV: {fmtNum(s.avg_ev, 1)} kph · Max distance: {fmtNum(s.max_distance, 1)} m
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
