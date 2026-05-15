"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SprayChart } from "@/components/charts/SprayChart";
import { ParkFactors } from "@/components/charts/ParkFactors";
import { StadiumDensity } from "@/components/charts/StadiumDensity";
import { HRAnalysis } from "@/components/charts/HRAnalysis";
import { StadiumComparison } from "@/components/charts/StadiumComparison";
import { Stadium3D } from "@/components/charts/Stadium3D";
import { Histogram } from "@/components/charts/Histogram";

export default function StadiumDetailPage() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params.name);
  const [hitsOnly, setHitsOnly] = useState(false);

  const spray = useQuery({
    queryKey: ["stadium-spray", name, hitsOnly],
    queryFn: () => api.stadiumSpray(name, hitsOnly),
  });
  const factors = useQuery({
    queryKey: ["stadium-factors", name],
    queryFn: () => api.stadiumParkFactors(name),
  });
  const dist = useQuery({
    queryKey: ["stadium-dist", name],
    queryFn: () => api.stadiumDistributions(name),
  });
  const hrs = useQuery({
    queryKey: ["stadium-hrs", name],
    queryFn: () => api.stadiumHRs(name),
  });
  const density = useQuery({
    queryKey: ["stadium-density", name],
    queryFn: () => api.stadiumDensity(name, 30),
  });
  const compare = useQuery({
    queryKey: ["stadiums-comparison"],
    queryFn: () => api.stadiumsComparison(),
  });

  const hits = spray.data?.filter((d) => d.content?.includes("安打")) ?? [];
  const hr = spray.data?.filter((d) => d.content?.includes("全壘打")).length ?? 0;
  const avgEv =
    spray.data && spray.data.length > 0
      ? spray.data.reduce(
          (s, d) => s + (d.hit_exit_speed_kph ?? 0),
          0,
        ) / spray.data.filter((d) => d.hit_exit_speed_kph != null).length
      : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
        <p className="text-sm text-slate-700 mt-1">
          {spray.data?.length ?? "—"} 顆擊球 · {hits.length} 顆安打 · {hr} 全壘打
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">總覽 + Park Factors</TabsTrigger>
          <TabsTrigger value="spray">擊球落點</TabsTrigger>
          <TabsTrigger value="density">熱密度圖</TabsTrigger>
          <TabsTrigger value="3d">3D 球場</TabsTrigger>
          <TabsTrigger value="hr">全壘打分析</TabsTrigger>
          <TabsTrigger value="dist">數值分佈</TabsTrigger>
          <TabsTrigger value="compare">跨球場比較</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="平均擊球初速" value={`${avgEv.toFixed(1)} kph`} />
            <StatCard
              label="最遠落點"
              value={`${(spray.data?.reduce((m, d) => Math.max(m, d.land_distance_m ?? 0), 0) ?? 0).toFixed(1)} m`}
            />
            <StatCard
              label="平均仰角"
              value={`${
                spray.data && spray.data.length > 0
                  ? (
                      spray.data.reduce((s, d) => s + (d.hit_launch_angle ?? 0), 0) /
                      spray.data.filter((d) => d.hit_launch_angle != null).length
                    ).toFixed(1)
                  : "—"
              }°`}
            />
          </div>
          {factors.data && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-slate-900">
                  Park Factors — 與其他球場相對因子
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ParkFactors
                  factors={factors.data.factors}
                  ownN={factors.data.own_n}
                  otherN={factors.data.other_n}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="spray">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">擊球落點散點圖</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-2 text-sm mb-3">
                <input
                  type="checkbox"
                  checked={hitsOnly}
                  onChange={(e) => setHitsOnly(e.target.checked)}
                />
                只看安打
              </label>
              {spray.data ? (
                <SprayChart data={spray.data} width={620} height={520} />
              ) : (
                <div className="text-slate-700 py-12 text-center">載入中…</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="density">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">
                擊球熱密度圖 (KDE)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {density.data ? (
                <StadiumDensity
                  cells={density.data.cells}
                  grid={density.data.grid}
                  L={density.data.L}
                />
              ) : (
                <div className="text-slate-700 py-12 text-center">載入中…</div>
              )}
              <p className="mt-2 text-xs text-slate-700">
                每格代表一塊球場區域 (約 {density.data ? (260 / density.data.grid).toFixed(1) : "—"} m × {density.data ? (260 / density.data.grid).toFixed(1) : "—"} m)；
                顏色越深 = 該區擊球越多。比散點圖更易看出「熱區」。
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="3d">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">
                3D 球場 + 擊球軌跡（最遠 50 顆）
              </CardTitle>
            </CardHeader>
            <CardContent>
              {spray.data ? (
                <Stadium3D data={spray.data} topOnly />
              ) : (
                <div className="text-slate-700 py-12 text-center">載入中…</div>
              )}
              <p className="mt-2 text-xs text-slate-700">
                每條弧線 = 一顆擊球的 3D 拋物線軌跡。白球會沿著最遠那顆飛行。
                滑鼠拖曳旋轉、滾輪縮放。
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hr">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">
                Home Run 分析
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hrs.data ? (
                <HRAnalysis hrs={hrs.data} />
              ) : (
                <div className="text-slate-700 py-12 text-center">載入中…</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dist" className="space-y-4">
          {dist.data && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">
                    擊球初速 (Exit Velocity) 分佈
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Histogram values={dist.data.ev} xLabel="kph" color="#dc2626"
                    domain={[100, 200]} width={620} height={240}
                    refLines={[{ value: 158, label: "HardHit", color: "#dc2626" }]}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">
                    發射仰角 (Launch Angle) 分佈
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Histogram values={dist.data.la} xLabel="°" color="#2563eb"
                    domain={[-30, 65]} width={620} height={240}
                    refLines={[
                      { value: 8, label: "Sweet ≥8", color: "#16a34a" },
                      { value: 32, label: "≤32", color: "#16a34a" },
                    ]}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">
                    飛行距離 (m) 分佈
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Histogram values={dist.data.dist} xLabel="m" color="#16a34a"
                    domain={[0, 130]} width={620} height={240} />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="compare">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-900">
                跨球場比較
              </CardTitle>
            </CardHeader>
            <CardContent>
              {compare.data ? (
                <StadiumComparison rows={compare.data} />
              ) : (
                <div className="text-slate-700 py-12 text-center">載入中…</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-slate-700 mb-1">{label}</div>
        <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      </CardContent>
    </Card>
  );
}
