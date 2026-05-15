"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamsPage() {
  const teams = useQuery({ queryKey: ["teams"], queryFn: api.teams });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">球隊</h1>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {teams.data?.map((t) => (
          <Link key={t.team_code} href={`/teams/${t.team_code}`}>
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardHeader>
                <CardTitle className="text-base text-slate-900">{t.team_name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <div>{t.players} 位球員</div>
                <div className="text-xs text-slate-500 mt-1">
                  代碼: {t.team_code}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
