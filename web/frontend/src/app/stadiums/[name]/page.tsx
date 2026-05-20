"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SprayChart } from "@/components/charts/SprayChart";
import { ParkFactors } from "@/components/charts/ParkFactors";
import { StadiumDensity } from "@/components/charts/StadiumDensity";
import { HRAnalysis } from "@/components/charts/HRAnalysis";
import { StadiumComparison } from "@/components/charts/StadiumComparison";
import { Stadium3D } from "@/components/charts/Stadium3D";
import { Histogram } from "@/components/charts/Histogram";
import {
  PageHeader,
  SectionCard,
  StatGrid,
  LoadingState,
} from "@/components/common";
import { useTabParam } from "@/lib/hooks/useTabParam";
import { fmtNum } from "@/lib/format";

export default function StadiumDetailPage() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params.name);
  const [hitsOnly, setHitsOnly] = useState(false);
  const [tab, setTab] = useTabParam("overview");

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
  const evValues = spray.data?.filter((d) => d.hit_exit_speed_kph != null) ?? [];
  const avgEv =
    evValues.length > 0
      ? evValues.reduce((s, d) => s + (d.hit_exit_speed_kph ?? 0), 0) / evValues.length
      : null;
  const laValues = spray.data?.filter((d) => d.hit_launch_angle != null) ?? [];
  const avgLa =
    laValues.length > 0
      ? laValues.reduce((s, d) => s + (d.hit_launch_angle ?? 0), 0) / laValues.length
      : null;
  const maxDist =
    spray.data && spray.data.length > 0
      ? spray.data.reduce((m, d) => Math.max(m, d.land_distance_m ?? 0), 0)
      : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={name}
        size="lg"
        subtitle={`${spray.data?.length ?? "—"} 顆擊球 · ${hits.length} 顆安打 · ${hr} 全壘打`}
      />

      <Tabs value={tab} onValueChange={setTab}>
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
          <StatGrid
            cols={{ base: 1, sm: 3 }}
            items={[
              { label: "平均擊球初速", value: avgEv, fmt: "f1", unit: "kph", tone: "red" },
              { label: "最遠落點", value: maxDist, fmt: "f1", unit: "m", tone: "blue" },
              { label: "平均仰角", value: avgLa, fmt: "f1", unit: "°", tone: "green" },
            ]}
          />
          {factors.data && (
            <SectionCard
              title="Park Factors — 與其他球場相對因子"
              footer="因子 100 = 與聯盟平均一致；> 100 = 此球場比聯盟平均更容易發生該事件。"
            >
              <ParkFactors
                factors={factors.data.factors}
                ownN={factors.data.own_n}
                otherN={factors.data.other_n}
              />
            </SectionCard>
          )}
        </TabsContent>

        <TabsContent value="spray">
          <SectionCard title="擊球落點散點圖">
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
              <LoadingState />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="density">
          <SectionCard
            title="擊球熱密度圖 (KDE)"
            footer={
              <>
                每格代表一塊球場區域 (約 {density.data ? fmtNum(260 / density.data.grid, 1) : "—"} m ×{" "}
                {density.data ? fmtNum(260 / density.data.grid, 1) : "—"} m)；
                顏色越深 = 該區擊球越多。比散點圖更易看出「熱區」。
              </>
            }
          >
            {density.data ? (
              <StadiumDensity cells={density.data.cells} grid={density.data.grid} L={density.data.L} />
            ) : (
              <LoadingState />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="3d">
          <SectionCard
            title="3D 球場 + 擊球軌跡（最遠 50 顆）"
            footer="每條弧線 = 一顆擊球的 3D 拋物線軌跡。白球會沿著最遠那顆飛行。滑鼠拖曳旋轉、滾輪縮放。"
          >
            {spray.data ? <Stadium3D data={spray.data} topOnly /> : <LoadingState />}
          </SectionCard>
        </TabsContent>

        <TabsContent value="hr">
          <SectionCard title="Home Run 分析">
            {hrs.data ? <HRAnalysis hrs={hrs.data} /> : <LoadingState />}
          </SectionCard>
        </TabsContent>

        <TabsContent value="dist" className="space-y-4">
          {dist.data && (
            <>
              <SectionCard title="擊球初速 (Exit Velocity) 分佈">
                <Histogram values={dist.data.ev} xLabel="kph" color="#dc2626"
                  domain={[100, 200]} width={620} height={240}
                  refLines={[{ value: 158, label: "HardHit", color: "#dc2626" }]}
                />
              </SectionCard>
              <SectionCard title="發射仰角 (Launch Angle) 分佈">
                <Histogram values={dist.data.la} xLabel="°" color="#2563eb"
                  domain={[-30, 65]} width={620} height={240}
                  refLines={[
                    { value: 8, label: "Sweet ≥8", color: "#16a34a" },
                    { value: 32, label: "≤32", color: "#16a34a" },
                  ]}
                />
              </SectionCard>
              <SectionCard title="飛行距離 (m) 分佈">
                <Histogram values={dist.data.dist} xLabel="m" color="#16a34a"
                  domain={[0, 130]} width={620} height={240} />
              </SectionCard>
            </>
          )}
        </TabsContent>

        <TabsContent value="compare">
          <SectionCard title="跨球場比較">
            {compare.data ? <StadiumComparison rows={compare.data} /> : <LoadingState />}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
