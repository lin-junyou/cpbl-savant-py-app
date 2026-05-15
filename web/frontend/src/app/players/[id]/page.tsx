"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PercentileBar } from "@/components/charts/PercentileBar";
import { StrikeZone, PITCH_COLORS } from "@/components/charts/StrikeZone";
import { SprayChart } from "@/components/charts/SprayChart";
import { StrikeZone3D } from "@/components/charts/StrikeZone3D";
import { PitchMovement } from "@/components/charts/PitchMovement";
import { Histogram } from "@/components/charts/Histogram";
import { ReleasePoint } from "@/components/charts/ReleasePoint";
import { ExitLaunchScatter } from "@/components/charts/ExitLaunchScatter";
import { ZoneHeatmap } from "@/components/charts/ZoneHeatmap";
import { PitchOutcomes } from "@/components/charts/PitchOutcomes";
import { SpinDirection } from "@/components/charts/SpinDirection";
import { ArmAngle } from "@/components/charts/ArmAngle";
import { GameLogs } from "@/components/charts/GameLogs";
import { HotColdZone } from "@/components/charts/HotColdZone";
import { PlateDiscipline } from "@/components/charts/PlateDiscipline";
import { RunValue } from "@/components/charts/RunValue";
import { RecentForm } from "@/components/charts/RecentForm";
import { VelocityDecline } from "@/components/charts/VelocityDecline";
import { BattedBallPie } from "@/components/charts/BattedBallPie";
import { CountStates } from "@/components/charts/CountStates";
import { PitchGrades } from "@/components/charts/PitchGrades";
import { PitchPhysics } from "@/components/charts/PitchPhysics";
import { ContactProfile } from "@/components/charts/ContactProfile";
import { WatchlistButton } from "@/components/WatchlistButton";
import { downloadCSV } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

// Percentile rankings shown in the iconic Savant bars.
const PR_BATTER: Array<[string, string, string?, "pct" | "f3" | "f1"?]> = [
  ["woba_pr", "wOBA", "woba", "f3"],
  ["ba_pr", "BA", "ba", "f3"],
  ["obp_pr", "OBP", "obp", "f3"],
  ["slg_pr", "SLG", "slg", "f3"],
  ["iso_pr", "ISO", "iso", "f3"],
  ["exit_velo_avg_pr", "Avg EV", "exit_velo_avg", "f1"],
  ["exit_velo_max_pr", "Max EV", "exit_velo_max", "f1"],
  ["hard_hit_pct_pr", "Hard Hit%", "hard_hit_pct", "pct"],
  ["barrel_pct_pr", "Barrel%", "barrel_pct", "pct"],
  ["k_pct_pr", "K%", "k_pct", "pct"],
  ["bb_pct_pr", "BB%", "bb_pct", "pct"],
  ["whiff_pct_pr", "Whiff%", "whiff_pct", "pct"],
  ["chase_pct_pr", "Chase%", "chase_pct", "pct"],
];

function fmt(value: unknown, kind?: string): string {
  if (value == null || value === "") return "—";
  const v = Number(value);
  if (isNaN(v)) return String(value);
  if (kind === "pct") return (v * 100).toFixed(1) + "%";
  if (kind === "f3") return v.toFixed(3);
  if (kind === "f1") return v.toFixed(1);
  if (kind === "0") return Math.round(v).toLocaleString();
  return String(value);
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const pid = params.id;
  const tab = search.get("tab") ?? "overview";
  const setTab = (v: string) => router.replace(`?tab=${v}`, { scroll: false });

  const profile = useQuery({
    queryKey: ["player", pid],
    queryFn: () => api.player(pid),
  });

  const role: "pitcher" | "hitter" =
    profile.data?.bio.position_code === "1" ? "pitcher" : "hitter";

  const locations = useQuery({
    queryKey: ["player-locations", pid, role],
    queryFn: () => api.playerLocations(pid, role),
    enabled: !!profile.data,
  });
  const spray = useQuery({
    queryKey: ["player-spray", pid, role],
    queryFn: () => api.playerSpray(pid, role),
    enabled: !!profile.data,
  });
  const movement = useQuery({
    queryKey: ["player-movement", pid],
    queryFn: () => api.playerMovement(pid),
    enabled: !!profile.data && role === "pitcher",
  });
  const contact = useQuery({
    queryKey: ["player-contact", pid, role],
    queryFn: () => api.playerContact(pid, role),
    enabled: !!profile.data,
  });
  const zoneStats = useQuery({
    queryKey: ["player-zone", pid, role],
    queryFn: () => api.playerZoneStats(pid, role),
    enabled: !!profile.data,
  });
  const pitchStats = useQuery({
    queryKey: ["player-pitch-stats", pid, role],
    queryFn: () => api.playerPitchStats(pid, role),
    enabled: !!profile.data,
  });
  const spinDist = useQuery({
    queryKey: ["player-spin-dist", pid],
    queryFn: () => api.playerSpinDistribution(pid),
    enabled: !!profile.data && role === "pitcher",
  });
  const gameLogs = useQuery({
    queryKey: ["player-game-logs", pid, role],
    queryFn: () => api.playerGameLogs(pid, role, 30),
    enabled: !!profile.data,
  });
  const zoneWoba = useQuery({
    queryKey: ["player-zone-woba", pid, role],
    queryFn: () => api.playerZoneWoba(pid, role),
    enabled: !!profile.data,
  });
  const runValue = useQuery({
    queryKey: ["player-run-value", pid, role],
    queryFn: () => api.playerRunValue(pid, role),
    enabled: !!profile.data && role === "pitcher",
  });
  const recentForm = useQuery({
    queryKey: ["player-recent-form", pid, role],
    queryFn: () => api.playerRecentForm(pid, role),
    enabled: !!profile.data,
  });
  const velocityDecline = useQuery({
    queryKey: ["player-velocity-decline", pid],
    queryFn: () => api.playerVelocityDecline(pid),
    enabled: !!profile.data && role === "pitcher",
  });
  const battedBall = useQuery({
    queryKey: ["player-batted-ball", pid, role],
    queryFn: () => api.playerBattedBall(pid, role),
    enabled: !!profile.data,
  });
  const countStates = useQuery({
    queryKey: ["player-count-states", pid, role],
    queryFn: () => api.playerCountStates(pid, role),
    enabled: !!profile.data && role === "pitcher",
  });
  const pitchGrades = useQuery({
    queryKey: ["player-pitch-grades", pid],
    queryFn: () => api.playerPitchGrades(pid),
    enabled: !!profile.data && role === "pitcher",
  });
  const pitchPhysics = useQuery({
    queryKey: ["player-pitch-physics", pid],
    queryFn: () => api.playerPitchPhysics(pid),
    enabled: !!profile.data && role === "pitcher",
  });
  const contactProfile = useQuery({
    queryKey: ["player-contact-profile", pid, role],
    queryFn: () => api.playerContactProfile(pid, role),
    enabled: !!profile.data,
  });

  const [pitchTypeFilter, setPitchTypeFilter] = useState<string | null>(null);

  if (profile.isLoading) return <div className="p-6">載入中...</div>;
  if (profile.error || !profile.data)
    return <div className="p-6">錯誤: {String(profile.error)}</div>;
  const { bio, season, pr } = profile.data;

  const pitchTypes =
    profile.data.trackman_repertoire
      ?.filter((r) => r.auto_pitch_type)
      ?.map((r) => r.auto_pitch_type as string) ?? [];

  const heightRel = (locations.data ?? [])
    .map((l) => l.rel_height)
    .filter((v): v is number => v != null);
  const velos = (locations.data ?? [])
    .map((l) => l.rel_speed_kph)
    .filter((v): v is number => v != null);
  const exitVelos = (contact.data ?? [])
    .map((c) => c.hit_exit_speed_kph)
    .filter((v): v is number => v != null);
  const launchAngles = (contact.data ?? [])
    .map((c) => c.hit_launch_angle)
    .filter((v): v is number => v != null);
  const distances = (contact.data ?? [])
    .map((c) => c.land_distance_m)
    .filter((v): v is number => v != null);

  return (
    <div className="space-y-0 -mx-4">
      {/* Savant-style dark header */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-slate-50 px-6 py-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row gap-5 items-start">
          <div className="w-32 h-32 rounded-md overflow-hidden bg-slate-700 flex-shrink-0 ring-2 ring-slate-600">
            {bio.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={bio.image_url as string}
                alt={bio.name as string}
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-4xl font-extrabold tracking-tight">
                {bio.name as string}
              </h1>
              <span className="text-2xl text-slate-400">
                #{bio.jersey_number as string}
              </span>
              <Badge variant="secondary" className="text-sm">
                {bio.position_name as string}
              </Badge>
            </div>
            <div className="mt-1 text-slate-300 text-sm">
              {bio.name_en as string} ·{" "}
              <span className="font-semibold text-slate-100">
                {bio.team_name as string}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-300">
              <span><span className="opacity-70">B/T</span> {bio.batting_hand}/{bio.throwing_hand}</span>
              <span><span className="opacity-70">Ht/Wt</span> {bio.height_cm}cm / {bio.weight_kg}kg</span>
              {bio.birthdate ? (
                <span><span className="opacity-70">DOB</span> {String(bio.birthdate).split("T")[0]}</span>
              ) : null}
              {bio.school ? (
                <span><span className="opacity-70">校</span> {bio.school as string}</span>
              ) : null}
              {bio.first_game_date ? (
                <span><span className="opacity-70">初登場</span> {String(bio.first_game_date).split("T")[0]}</span>
              ) : null}
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <div className="inline-flex bg-slate-800 rounded-md p-1">
                <span className="px-3 py-1 text-xs rounded bg-red-600 text-white font-semibold">
                  {role === "pitcher" ? "投手 PITCHING" : "打者 BATTING"}
                </span>
                <span className="px-3 py-1 text-xs rounded text-slate-300">
                  Statcast 2026
                </span>
              </div>
              <WatchlistButton pid={pid} />
              {gameLogs.data && (
                <Button
                  variant="outline" size="sm"
                  onClick={() =>
                    downloadCSV(`${pid}_game-logs.csv`, gameLogs.data!)
                  }
                >
                  <Download className="w-4 h-4 mr-1" /> 場次 CSV
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">總覽 (Statcast)</TabsTrigger>
            {role === "pitcher" ? (
              <TabsTrigger value="arsenal">球種庫 Arsenal</TabsTrigger>
            ) : (
              <TabsTrigger value="batted">擊球品質 Quality</TabsTrigger>
            )}
            <TabsTrigger value="discipline">配球紀律 PD</TabsTrigger>
            <TabsTrigger value="zone">球路位置</TabsTrigger>
            <TabsTrigger value="zone3d">3D 好球帶</TabsTrigger>
            <TabsTrigger value="spray">擊球落點</TabsTrigger>
            <TabsTrigger value="games">場次紀錄</TabsTrigger>
          </TabsList>

          {/* ─── Overview Tab ─── */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-slate-900">
                  中職百分位 PR — Percentile Rankings 2026
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
                  {PR_BATTER.map(([prKey, label, valKey, valKind]) => {
                    if (pr[prKey] == null) return null;
                    const raw = valKey
                      ? (season as Record<string, unknown> | null)?.[valKey]
                      : null;
                    return (
                      <PercentileBar
                        key={prKey}
                        label={label}
                        pr={pr[prKey]}
                        value={raw != null ? fmt(raw, valKind) : ""}
                      />
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-slate-800">
                  紅 = 聯盟頂尖（高 PR）；藍 = 較差。投手的攻擊指標
                  （Whiff%、Chase%、K%）越高越好；被打 wOBA / EV 以投手角度反向理解。
                </p>
              </CardContent>
            </Card>

            {/* Statcast stats grid */}
            {season && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">
                    Statcast 進階數據
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-6 text-sm">
                    {[
                      ["PA", season.pa, "0"],
                      ["wOBA", season.woba, "f3"],
                      ["BA", season.ba, "f3"],
                      ["OBP", season.obp, "f3"],
                      ["SLG", season.slg, "f3"],
                      ["ISO", season.iso, "f3"],
                      ["K%", season.k_pct, "pct"],
                      ["BB%", season.bb_pct, "pct"],
                      ["Whiff%", season.whiff_pct, "pct"],
                      ["Chase%", season.chase_pct, "pct"],
                      ["Hard Hit%", season.hard_hit_pct, "pct"],
                      ["Barrel%", season.barrel_pct, "pct"],
                      ["EV avg (kph)", season.exit_velo_avg, "f1"],
                      ["EV max (kph)", season.exit_velo_max, "f1"],
                      ["Barrels", season.barrels, "0"],
                    ].map(([label, val, kind]) => (
                      <div
                        key={label as string}
                        className="border-l-2 border-slate-200 pl-3"
                      >
                        <div className="text-[10px] uppercase tracking-wide text-slate-700">
                          {label as string}
                        </div>
                        <div className="font-bold text-base tabular-nums text-slate-900">
                          {fmt(val, kind as string)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Role-specific overview content */}
            {role === "pitcher" && (
              <>
                {movement.data && movement.data.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        球種位移 Pitch Movement
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PitchMovement
                        points={movement.data.map((d) => ({
                          pitch_type: d.pitch_type,
                          horiz: d.horiz,
                          vert: d.vert,
                          count: d.count,
                          avg_kph: d.avg_kph ?? undefined,
                          spin: d.spin ?? undefined,
                        }))}
                        width={560}
                        height={480}
                      />
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        球速分布 Velocity Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Histogram
                        values={velos}
                        xLabel="kph"
                        color="#dc2626"
                        refLines={[
                          {
                            value: velos.length
                              ? velos.reduce((s, x) => s + x, 0) / velos.length
                              : 0,
                            label: "Avg",
                          },
                        ]}
                        width={420}
                        height={240}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        釋球點 Release Point
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ReleasePoint pitches={locations.data ?? []} width={420} height={340} />
                    </CardContent>
                  </Card>
                </div>

                {zoneStats.data && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        9 宮格分佈（投出）
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-6 items-start">
                        <ZoneHeatmap cells={zoneStats.data} metric="pitches" title="球數" />
                        <ZoneHeatmap
                          cells={zoneStats.data}
                          metric="whiffs"
                          asRate
                          title="揮空率"
                        />
                        <ZoneHeatmap
                          cells={zoneStats.data}
                          metric="hits"
                          asRate
                          title="被打安打率"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {role === "hitter" && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        擊球初速分布 Exit Velocity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Histogram
                        values={exitVelos}
                        xLabel="kph"
                        color="#dc2626"
                        domain={[100, 200]}
                        refLines={[
                          { value: 158, label: "HardHit≥158", color: "#dc2626" },
                          {
                            value: exitVelos.length
                              ? exitVelos.reduce((s, x) => s + x, 0) /
                                exitVelos.length
                              : 0,
                            label: "Avg",
                          },
                        ]}
                        width={420}
                        height={240}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        發射仰角分布 Launch Angle
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Histogram
                        values={launchAngles}
                        xLabel="°"
                        color="#2563eb"
                        domain={[-30, 65]}
                        refLines={[
                          { value: 8, label: "Sweet ≥8°", color: "#16a34a" },
                          { value: 32, label: "≤32°", color: "#16a34a" },
                        ]}
                        width={420}
                        height={240}
                      />
                    </CardContent>
                  </Card>
                </div>

                {contact.data && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        EV × LA 擊球品質區
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ExitLaunchScatter
                        events={contact.data}
                        width={560}
                        height={420}
                      />
                      <p className="mt-2 text-xs text-slate-800">
                        紅色區 = Barrel 區（EV ≥ 158 kph、LA 24-33°），命中時長打率最高；
                        橘=Solid、黃=Sweet-Spot 仰角帶；其他多為弱擊球。
                      </p>
                    </CardContent>
                  </Card>
                )}

                {distances.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        飛行距離分布
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Histogram
                        values={distances}
                        xLabel="m"
                        color="#16a34a"
                        domain={[0, 130]}
                        width={560}
                        height={220}
                      />
                    </CardContent>
                  </Card>
                )}

                {zoneStats.data && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        9 宮格表現 Strike-Zone Performance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-6 items-start">
                        <ZoneHeatmap cells={zoneStats.data} metric="pitches" title="看球量" />
                        <ZoneHeatmap
                          cells={zoneStats.data}
                          metric="swings"
                          asRate
                          title="揮棒率"
                        />
                        <ZoneHeatmap
                          cells={zoneStats.data}
                          metric="whiffs"
                          asRate
                          title="揮空率"
                        />
                        <ZoneHeatmap
                          cells={zoneStats.data}
                          metric="hits"
                          asRate
                          title="擊出安打率"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ─── Pitcher Arsenal Tab ─── */}
          {role === "pitcher" && (
            <TabsContent value="arsenal" className="space-y-4">
              {pitchStats.data && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900">
                      Statcast Pitch Arsenal — 球種庫統計
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PitchOutcomes
                      stats={pitchStats.data}
                      playerName={bio.name as string}
                    />
                  </CardContent>
                </Card>
              )}

              {runValue.data && runValue.data.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900">
                      Run Value — 各球種跑分價值
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RunValue rows={runValue.data} role="pitcher" />
                  </CardContent>
                </Card>
              )}

              {pitchGrades.data && pitchGrades.data.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900">
                      Stuff+ / Command+ 球種評分
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PitchGrades rows={pitchGrades.data} />
                  </CardContent>
                </Card>
              )}

              {pitchPhysics.data && pitchPhysics.data.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900">
                      Pitch Physics — 釋球延伸 / 進壘速度 / 進壘角度
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PitchPhysics rows={pitchPhysics.data} />
                  </CardContent>
                </Card>
              )}

              {countStates.data && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900">
                      球數狀況配球 Count States
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CountStates data={countStates.data} />
                  </CardContent>
                </Card>
              )}

              {velocityDecline.data && velocityDecline.data.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900">
                      場內球速衰減 Velocity Decline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VelocityDecline games={velocityDecline.data} />
                  </CardContent>
                </Card>
              )}

              {spinDist.data && spinDist.data.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900">
                      Spin Direction — 旋轉方向時鐘 + 密度熱區 + 動畫
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SpinDirection points={spinDist.data} />
                    <p className="mt-3 text-xs text-slate-700">
                      時鐘外緣的色弧 = 該球種所有球的旋轉方向 KDE 分佈，越深越集中。
                      箭頭以動畫旋轉，速度依平均 RPM 同步（已放慢 ~120× 以利肉眼觀察）。
                      12:00 = 純倒旋（升力）；6:00 = 純上旋；3:00 = 朝捕手右橫旋。
                    </p>
                  </CardContent>
                </Card>
              )}

              {locations.data && bio.height_cm && (
                <div className="grid gap-4 md:grid-cols-[360px_1fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        Pitcher Arm Angle — 投球臂角
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ArmAngle
                        pitches={locations.data}
                        bodyHeightCm={bio.height_cm as number}
                        throws={bio.throwing_hand as string}
                      />
                      <p className="mt-2 text-xs text-slate-700">
                        以 atan2(釋球高度 − 肩高, |釋球側向|) 計算；
                        肩高約取身高 × 0.82。Statcast 標準分類：
                        25-40° 低側肩 / 40-55° 標準 3/4 / 55-70° 高 3/4 /
                        70°+ 高肩過頂。
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        釋球點散佈 Release Point
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ReleasePoint
                        pitches={locations.data}
                        width={460}
                        height={360}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}
              {movement.data && movement.data.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900">
                      球種位移與球速比較
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PitchMovement
                      points={movement.data.map((d) => ({
                        pitch_type: d.pitch_type,
                        horiz: d.horiz,
                        vert: d.vert,
                        count: d.count,
                        avg_kph: d.avg_kph ?? undefined,
                        spin: d.spin ?? undefined,
                      }))}
                      width={560}
                      height={480}
                    />
                  </CardContent>
                </Card>
              )}
              {pitchTypes.length > 0 && locations.data && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900">
                      每球種進壘位置
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4">
                      {pitchTypes.slice(0, 6).map((pt) => (
                        <div key={pt}>
                          <div className="text-center text-xs font-semibold mb-1 text-slate-700">
                            <span
                              className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                              style={{ background: PITCH_COLORS[pt] ?? "#888" }}
                            />
                            {pt}
                          </div>
                          <StrikeZone
                            pitches={locations.data!}
                            pitchTypeFilter={pt}
                            width={220}
                            height={300}
                            mode="hexbin"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* ─── Batter Quality Tab ─── */}
          {role === "hitter" && (
            <TabsContent value="batted" className="space-y-4">
              {pitchStats.data && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900">
                      面對球種表現 Performance vs Pitch Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PitchOutcomes stats={pitchStats.data} />
                  </CardContent>
                </Card>
              )}
              {contact.data && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        EV × LA 擊球品質
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ExitLaunchScatter events={contact.data} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base text-slate-900">
                        飛行距離分布
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Histogram
                        values={distances}
                        xLabel="m"
                        color="#16a34a"
                        domain={[0, 130]}
                        width={420}
                        height={240}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          )}

          {/* ─── Plate Discipline + Hot/Cold Zone ─── */}
          <TabsContent value="discipline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-slate-900">
                  Plate Discipline — 配球紀律
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PlateDiscipline pid={pid} role={role} />
              </CardContent>
            </Card>
            {zoneWoba.data && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">
                    Hot / Cold Zone — 9 宮格 wOBA / SLG / BA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-6 items-start">
                    <HotColdZone cells={zoneWoba.data} metric="woba" title="wOBA" />
                    <HotColdZone cells={zoneWoba.data} metric="slg" title="SLG" />
                    <HotColdZone cells={zoneWoba.data} metric="ba" title="BA (打擊率)" />
                  </div>
                  <p className="mt-3 text-xs text-slate-700">
                    {role === "pitcher"
                      ? "顯示對手在不同好球帶位置的攻擊表現（紅=對方強、藍=對方弱）。"
                      : "本人在不同好球帶位置的擊球表現。"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── Game Logs ─── */}
          <TabsContent value="games" className="space-y-4">
            {recentForm.data && recentForm.data.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">
                    Recent Form — 近期狀態趨勢
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RecentForm rows={recentForm.data} role={role} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base text-slate-900">
                  最近 30 場比賽紀錄
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gameLogs.data ? (
                  <GameLogs rows={gameLogs.data} role={role} />
                ) : (
                  <div className="text-slate-700 py-6 text-center">載入中…</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Pitch Locations (Strike Zone 2D) ─── */}
          <TabsContent value="zone">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-slate-900">
                  球路位置（{role === "pitcher" ? "投出" : "接到"}）
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pitchTypes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      onClick={() => setPitchTypeFilter(null)}
                      className={`text-xs px-2 py-1 rounded border ${
                        pitchTypeFilter == null
                          ? "bg-primary text-primary-foreground"
                          : "bg-background"
                      }`}
                    >
                      全部
                    </button>
                    {pitchTypes.map((pt) => (
                      <button
                        key={pt}
                        onClick={() => setPitchTypeFilter(pt)}
                        className={`text-xs px-2 py-1 rounded border ${
                          pitchTypeFilter === pt
                            ? "bg-primary text-primary-foreground"
                            : "bg-background"
                        }`}
                        style={{
                          borderColor: PITCH_COLORS[pt] ?? "#ccc",
                          color:
                            pitchTypeFilter === pt
                              ? undefined
                              : PITCH_COLORS[pt],
                        }}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>
                )}
                {locations.data && locations.data.length > 0 ? (
                  <StrikeZone
                    pitches={locations.data}
                    pitchTypeFilter={pitchTypeFilter}
                    width={420}
                    height={500}
                  />
                ) : (
                  <div className="text-slate-800 py-12 text-center">
                    沒有球路位置資料
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="zone3d">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-slate-900">
                  3D 好球帶（拖曳旋轉、滾輪縮放）
                </CardTitle>
              </CardHeader>
              <CardContent>
                {locations.data && locations.data.length > 0 ? (
                  <StrikeZone3D locations={locations.data} height={560} />
                ) : (
                  <div className="text-slate-800 py-12 text-center">
                    沒有球路位置資料
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="spray" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-slate-900">
                  擊球落點（{role === "pitcher" ? "對手對戰" : "本人擊球"}）
                </CardTitle>
              </CardHeader>
              <CardContent>
                {spray.data && spray.data.length > 0 ? (
                  <SprayChart data={spray.data} width={560} height={520} />
                ) : (
                  <div className="text-slate-800 py-12 text-center">
                    沒有擊球落點資料
                  </div>
                )}
              </CardContent>
            </Card>
            {battedBall.data && battedBall.data.n > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">
                    擊球類型分佈 Batted Ball Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BattedBallPie data={battedBall.data} />
                </CardContent>
              </Card>
            )}
            {contactProfile.data && contactProfile.data.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">
                    Contact Profile — 接觸點 / 擊球後 spin / 滯空
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ContactProfile rows={contactProfile.data} />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
