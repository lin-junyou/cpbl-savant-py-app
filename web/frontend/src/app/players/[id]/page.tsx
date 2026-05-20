"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PercentileBar } from "@/components/charts/PercentileBar";
import { StrikeZone, PITCH_COLORS } from "@/components/charts/StrikeZone";
import { PitchTypeHeatmapGrid } from "@/components/charts/PitchTypeHeatmap";
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
import {
  PlayerHero,
  SectionCard,
  StatGrid,
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/common";
import { useTabParam } from "@/lib/hooks/useTabParam";
import { fmt, type FmtKind } from "@/lib/format";

// Percentile rankings shown in the iconic Savant bars.
// pr_key, label, value_key (in season row), fmt
type PRRow = [string, string, string?, FmtKind?];

// For hitters: shown as own offensive stats.
const PR_HITTER: PRRow[] = [
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

// For pitchers: contact-against stats are framed as "opp" (對手),
// while strikeout / whiff / chase metrics stay as the pitcher's own.
// Backend already inverts opp PRs so 高 PR = elite (i.e. 對手難打).
const PR_PITCHER: PRRow[] = [
  ["woba_pr", "對手 wOBA", "woba", "f3"],
  ["ba_pr", "對手 BA", "ba", "f3"],
  ["slg_pr", "對手 SLG", "slg", "f3"],
  ["iso_pr", "對手 ISO", "iso", "f3"],
  ["exit_velo_avg_pr", "對手 Avg EV", "exit_velo_avg", "f1"],
  ["exit_velo_max_pr", "對手 Max EV", "exit_velo_max", "f1"],
  ["hard_hit_pct_pr", "對手 Hard Hit%", "hard_hit_pct", "pct"],
  ["barrel_pct_pr", "對手 Barrel%", "barrel_pct", "pct"],
  ["k_pct_pr", "K%", "k_pct", "pct"],
  ["bb_pct_pr", "BB%", "bb_pct", "pct"],
  ["whiff_pct_pr", "Whiff%", "whiff_pct", "pct"],
  ["chase_pct_pr", "Chase%", "chase_pct", "pct"],
];

type StatRow = [string, string, FmtKind];

const SEASON_STATS_HITTER: StatRow[] = [
  ["pa", "PA", "int"],
  ["woba", "wOBA", "f3"],
  ["ba", "BA", "f3"],
  ["obp", "OBP", "f3"],
  ["slg", "SLG", "f3"],
  ["iso", "ISO", "f3"],
  ["k_pct", "K%", "pct"],
  ["bb_pct", "BB%", "pct"],
  ["whiff_pct", "Whiff%", "pct"],
  ["chase_pct", "Chase%", "pct"],
  ["hard_hit_pct", "Hard Hit%", "pct"],
  ["barrel_pct", "Barrel%", "pct"],
  ["exit_velo_avg", "EV avg (kph)", "f1"],
  ["exit_velo_max", "EV max (kph)", "f1"],
  ["barrels", "Barrels", "int"],
];

// Pitcher view: contact-against stats labelled with 「對手」 prefix so they
// can't be confused with the pitcher's own batting line.
const SEASON_STATS_PITCHER: StatRow[] = [
  ["pa", "TBF", "int"],
  ["woba", "對手 wOBA", "f3"],
  ["ba", "對手 BA", "f3"],
  ["obp", "對手 OBP", "f3"],
  ["slg", "對手 SLG", "f3"],
  ["iso", "對手 ISO", "f3"],
  ["k_pct", "K%", "pct"],
  ["bb_pct", "BB%", "pct"],
  ["whiff_pct", "Whiff%", "pct"],
  ["chase_pct", "Chase%", "pct"],
  ["hard_hit_pct", "對手 Hard Hit%", "pct"],
  ["barrel_pct", "對手 Barrel%", "pct"],
  ["exit_velo_avg", "對手 EV avg (kph)", "f1"],
  ["exit_velo_max", "對手 EV max (kph)", "f1"],
  ["barrels", "對手 Barrels", "int"],
];

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const pid = params.id;
  const [tab, setTab] = useTabParam("overview");

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
  const playerTraj = useQuery({
    queryKey: ["player-trajectory", pid, role],
    // 60 curves is enough to read pitch shape per type without spaghettifying the canvas.
    queryFn: () => api.playerTrajectory(pid, role, 60),
    enabled: !!profile.data,
  });

  const [pitchTypeFilter, setPitchTypeFilter] = useState<string | null>(null);

  if (profile.isLoading) return <LoadingState size="page" />;
  if (profile.error || !profile.data) return <ErrorState size="page" error={profile.error} />;
  const { bio, season, pr } = profile.data;

  const pitchTypes =
    profile.data.trackman_repertoire
      ?.filter((r) => r.auto_pitch_type)
      ?.map((r) => r.auto_pitch_type as string) ?? [];

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

  const facts: Array<{ label: string; value: React.ReactNode } | null> = [
    { label: "B/T", value: `${bio.batting_hand}/${bio.throwing_hand}` },
    { label: "Ht/Wt", value: `${bio.height_cm}cm / ${bio.weight_kg}kg` },
    bio.birthdate ? { label: "DOB", value: String(bio.birthdate).split("T")[0] } : null,
    bio.school ? { label: "校", value: bio.school as string } : null,
    bio.first_game_date
      ? { label: "初登場", value: String(bio.first_game_date).split("T")[0] }
      : null,
  ];

  return (
    <div className="space-y-0">
      <PlayerHero
        name={bio.name as string}
        nameEn={bio.name_en as string}
        imageUrl={bio.image_url as string}
        jerseyNumber={bio.jersey_number as string}
        positionName={bio.position_name as string}
        teamName={bio.team_name as string}
        roleLabel={role === "pitcher" ? "投手 PITCHING" : "打者 BATTING"}
        season="Statcast 2026"
        facts={facts}
        actions={
          <>
            <WatchlistButton pid={pid} />
            {gameLogs.data && (
              <Button
                variant="outline" size="sm"
                onClick={() => downloadCSV(`${pid}_game-logs.csv`, gameLogs.data!)}
              >
                <Download className="w-4 h-4 mr-1" /> 場次 CSV
              </Button>
            )}
          </>
        }
      />

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
            <SectionCard
              title={`中職百分位 PR — Percentile Rankings 2026${role === "pitcher" ? "（投手視角）" : "（打者）"}`}
              footer={
                role === "pitcher"
                  ? "紅 = 投手 elite（高 PR）；藍 = 較差。所有「對手 …」項目已從投手角度反轉（高 PR = 對手難打）；K% / Whiff% / Chase% / BB% 為投手本人指標，越高越主動（BB% 低 PR 較差）。"
                  : "紅 = 聯盟頂尖（高 PR）；藍 = 較差。K% / Whiff% / Chase% 為承受面數值（低 PR 較好需注意），其他越高越好。"
              }
            >
              <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
                {(role === "pitcher" ? PR_PITCHER : PR_HITTER).map(
                  ([prKey, label, valKey, valKind]) => {
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
                  },
                )}
              </div>
            </SectionCard>

            {season && (
              <SectionCard
                title={
                  role === "pitcher"
                    ? "Statcast 進階數據（投手 — 對手成績）"
                    : "Statcast 進階數據"
                }
              >
                <StatGrid
                  variant="inline"
                  cols={{ base: 3, sm: 4, md: 6 }}
                  items={(role === "pitcher" ? SEASON_STATS_PITCHER : SEASON_STATS_HITTER).map(
                    ([key, label, kind]) => ({
                      label,
                      value: season[key],
                      fmt: kind,
                    }),
                  )}
                />
              </SectionCard>
            )}

            {role === "pitcher" && (
              <>
                {movement.data && movement.data.length > 0 && (
                  <SectionCard title="球種位移 Pitch Movement">
                    <PitchMovement
                      points={movement.data.map((d) => ({
                        pitch_type: d.pitch_type, horiz: d.horiz, vert: d.vert,
                        count: d.count,
                        avg_kph: d.avg_kph ?? undefined,
                        spin: d.spin ?? undefined,
                      }))}
                      width={560} height={480}
                    />
                  </SectionCard>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <SectionCard title="球速分布 Velocity Distribution">
                    <Histogram
                      values={velos}
                      xLabel="kph" color="#dc2626"
                      refLines={[{
                        value: velos.length ? velos.reduce((s, x) => s + x, 0) / velos.length : 0,
                        label: "Avg",
                      }]}
                      width={420} height={240}
                    />
                  </SectionCard>
                  <SectionCard title="釋球點 Release Point">
                    <ReleasePoint pitches={locations.data ?? []} width={420} height={340} />
                  </SectionCard>
                </div>

                {zoneStats.data && (
                  <SectionCard title="9 宮格分佈（投出）">
                    <div className="flex flex-wrap gap-6 items-start">
                      <ZoneHeatmap cells={zoneStats.data} metric="pitches" title="球數" />
                      <ZoneHeatmap cells={zoneStats.data} metric="whiffs" asRate title="揮空率" />
                      <ZoneHeatmap cells={zoneStats.data} metric="hits" asRate title="被打安打率" />
                    </div>
                  </SectionCard>
                )}
              </>
            )}

            {role === "hitter" && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <SectionCard title="擊球初速分布 Exit Velocity">
                    <Histogram
                      values={exitVelos}
                      xLabel="kph" color="#dc2626"
                      domain={[100, 200]}
                      refLines={[
                        { value: 158, label: "HardHit≥158", color: "#dc2626" },
                        {
                          value: exitVelos.length
                            ? exitVelos.reduce((s, x) => s + x, 0) / exitVelos.length
                            : 0,
                          label: "Avg",
                        },
                      ]}
                      width={420} height={240}
                    />
                  </SectionCard>
                  <SectionCard title="發射仰角分布 Launch Angle">
                    <Histogram
                      values={launchAngles}
                      xLabel="°" color="#2563eb"
                      domain={[-30, 65]}
                      refLines={[
                        { value: 8, label: "Sweet ≥8°", color: "#16a34a" },
                        { value: 32, label: "≤32°", color: "#16a34a" },
                      ]}
                      width={420} height={240}
                    />
                  </SectionCard>
                </div>

                {contact.data && (
                  <SectionCard
                    title="EV × LA 擊球品質區"
                    footer="紅色區 = Barrel 區（EV ≥ 158 kph、LA 24-33°），命中時長打率最高；橘=Solid、黃=Sweet-Spot 仰角帶；其他多為弱擊球。"
                  >
                    <ExitLaunchScatter events={contact.data} width={560} height={420} />
                  </SectionCard>
                )}

                {distances.length > 0 && (
                  <SectionCard title="飛行距離分布">
                    <Histogram
                      values={distances}
                      xLabel="m" color="#16a34a"
                      domain={[0, 130]} width={560} height={220}
                    />
                  </SectionCard>
                )}

                {zoneStats.data && (
                  <SectionCard title="9 宮格表現 Strike-Zone Performance">
                    <div className="flex flex-wrap gap-6 items-start">
                      <ZoneHeatmap cells={zoneStats.data} metric="pitches" title="看球量" />
                      <ZoneHeatmap cells={zoneStats.data} metric="swings" asRate title="揮棒率" />
                      <ZoneHeatmap cells={zoneStats.data} metric="whiffs" asRate title="揮空率" />
                      <ZoneHeatmap cells={zoneStats.data} metric="hits" asRate title="擊出安打率" />
                    </div>
                  </SectionCard>
                )}
              </>
            )}
          </TabsContent>

          {/* ─── Pitcher Arsenal Tab ─── */}
          {role === "pitcher" && (
            <TabsContent value="arsenal" className="space-y-4">
              {pitchStats.data && (
                <SectionCard title="Statcast Pitch Arsenal — 球種庫統計">
                  <PitchOutcomes stats={pitchStats.data} playerName={bio.name as string} />
                </SectionCard>
              )}

              {runValue.data && runValue.data.length > 0 && (
                <SectionCard title="Run Value — 各球種跑分價值">
                  <RunValue rows={runValue.data} role="pitcher" />
                </SectionCard>
              )}

              {pitchGrades.data && pitchGrades.data.length > 0 && (
                <SectionCard title="Stuff+ / Command+ 球種評分">
                  <PitchGrades rows={pitchGrades.data} />
                </SectionCard>
              )}

              {pitchPhysics.data && pitchPhysics.data.length > 0 && (
                <SectionCard
                  title="Pitch Physics — 釋球延伸 / 進壘速度 / 進壘角度"
                  footer={
                    <>
                      <b>Ext</b> = 釋球延伸（出手時離本壘的距離，壓縮投打距離）；
                      <b>Δ kph</b> = 球速衰減（rel − zone，越小代表 carry 越好）；
                      <b>VAA</b> = 垂直進壘角度（負值越接近 0 越平直、rising 效應越強）；
                      <b>HAA</b> = 水平進壘角度。
                    </>
                  }
                >
                  <PitchPhysics rows={pitchPhysics.data} />
                </SectionCard>
              )}

              {countStates.data && (
                <SectionCard
                  title="球數狀況配球 Count States"
                  footer="不同球數狀況下的球種選擇。兩好球時通常增加 breaking ball 比例去搶 K。"
                >
                  <CountStates data={countStates.data} />
                </SectionCard>
              )}

              {velocityDecline.data && velocityDecline.data.length > 0 && (
                <SectionCard title="場內球速衰減 Velocity Decline">
                  <VelocityDecline games={velocityDecline.data} />
                </SectionCard>
              )}

              {spinDist.data && spinDist.data.length > 0 && (
                <SectionCard
                  title="Spin Direction — 旋轉方向時鐘 + 密度熱區 + 動畫"
                  footer={
                    <>
                      時鐘外緣色弧 = 該球種旋轉方向 KDE 分佈，越深越集中；箭頭動畫速度依平均 RPM 同步（已放慢 ~120× 以利肉眼觀察）。
                      12:00 純倒旋（升力）；6:00 純上旋；3:00 朝捕手右橫旋。
                      表中為推算 Tilt（由 magnus 球路位移反推），CPBL Trackman 不公開 gyroscope 直接量測，故無 Active Spin%。
                    </>
                  }
                >
                  <SpinDirection points={spinDist.data} />
                </SectionCard>
              )}

              {locations.data && Boolean(bio.height_cm) && (
                <div className="grid gap-4 md:grid-cols-[360px_1fr]">
                  <SectionCard
                    title="Pitcher Arm Angle — 投球臂角"
                    footer="以 atan2(釋球高度 − 肩高, |釋球側向|) 計算；肩高約取身高 × 0.82。Statcast 標準分類：25-40° 低側肩 / 40-55° 標準 3/4 / 55-70° 高 3/4 / 70°+ 高肩過頂。"
                  >
                    <ArmAngle
                      pitches={locations.data}
                      bodyHeightCm={bio.height_cm as number}
                      throws={bio.throwing_hand as string}
                    />
                  </SectionCard>
                  <SectionCard title="釋球點散佈 Release Point">
                    <ReleasePoint pitches={locations.data} width={460} height={360} />
                  </SectionCard>
                </div>
              )}

              {movement.data && movement.data.length > 0 && (
                <SectionCard title="球種位移與球速比較">
                  <PitchMovement
                    points={movement.data.map((d) => ({
                      pitch_type: d.pitch_type, horiz: d.horiz, vert: d.vert,
                      count: d.count,
                      avg_kph: d.avg_kph ?? undefined,
                      spin: d.spin ?? undefined,
                    }))}
                    width={560} height={480}
                  />
                </SectionCard>
              )}

              {pitchTypes.length > 0 && locations.data && (
                <SectionCard
                  title="每球種進壘位置 — Pitch Location by Type"
                  footer="卡片右上角的棒球依該球種的推算 spin axis（tilt）與 RPM 旋轉（已放慢 60×）；虛線 = 旋轉軸方向。"
                >
                  <PitchTypeHeatmapGrid
                    pitches={locations.data}
                    pitchTypes={pitchTypes}
                    spinByType={spinDist.data}
                  />
                </SectionCard>
              )}
            </TabsContent>
          )}

          {/* ─── Batter Quality Tab ─── */}
          {role === "hitter" && (
            <TabsContent value="batted" className="space-y-4">
              {pitchStats.data && (
                <SectionCard title="面對球種表現 Performance vs Pitch Type">
                  <PitchOutcomes stats={pitchStats.data} />
                </SectionCard>
              )}
              {contact.data && (
                <div className="grid gap-4 md:grid-cols-2">
                  <SectionCard title="EV × LA 擊球品質">
                    <ExitLaunchScatter events={contact.data} />
                  </SectionCard>
                  <SectionCard title="飛行距離分布">
                    <Histogram
                      values={distances}
                      xLabel="m" color="#16a34a"
                      domain={[0, 130]} width={420} height={240}
                    />
                  </SectionCard>
                </div>
              )}
            </TabsContent>
          )}

          {/* ─── Plate Discipline + Hot/Cold Zone ─── */}
          <TabsContent value="discipline" className="space-y-4">
            <SectionCard title="Plate Discipline — 配球紀律">
              <PlateDiscipline pid={pid} role={role} />
            </SectionCard>
            {zoneWoba.data && (
              <SectionCard
                title="Hot / Cold Zone — 9 宮格 wOBA / SLG / BA"
                footer={
                  role === "pitcher"
                    ? "顯示對手在不同好球帶位置的攻擊表現（紅=對方強、藍=對方弱）。"
                    : "本人在不同好球帶位置的擊球表現。"
                }
              >
                <div className="flex flex-wrap gap-6 items-start">
                  <HotColdZone cells={zoneWoba.data} metric="woba" title="wOBA" />
                  <HotColdZone cells={zoneWoba.data} metric="slg" title="SLG" />
                  <HotColdZone cells={zoneWoba.data} metric="ba" title="BA (打擊率)" />
                </div>
              </SectionCard>
            )}
          </TabsContent>

          {/* ─── Game Logs ─── */}
          <TabsContent value="games" className="space-y-4">
            {recentForm.data && recentForm.data.length > 0 && (
              <SectionCard title="Recent Form — 近期狀態趨勢">
                <RecentForm rows={recentForm.data} role={role} />
              </SectionCard>
            )}

            <SectionCard title="最近 30 場比賽紀錄">
              {gameLogs.data ? (
                <GameLogs rows={gameLogs.data} role={role} />
              ) : (
                <LoadingState size="tight" />
              )}
            </SectionCard>
          </TabsContent>

          {/* ─── Pitch Locations (Strike Zone 2D) ─── */}
          <TabsContent value="zone">
            <SectionCard title={`球路位置（${role === "pitcher" ? "投出" : "接到"}）`}>
              {pitchTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => setPitchTypeFilter(null)}
                    className={`text-xs px-2 py-1 rounded border ${
                      pitchTypeFilter == null
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-300"
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
                          ? "text-white"
                          : "bg-white"
                      }`}
                      style={{
                        borderColor: PITCH_COLORS[pt] ?? "#ccc",
                        background: pitchTypeFilter === pt ? PITCH_COLORS[pt] ?? "#0f172a" : undefined,
                        color: pitchTypeFilter === pt ? "white" : PITCH_COLORS[pt],
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
                <EmptyState text="沒有球路位置資料" />
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="zone3d">
            <SectionCard title="3D 好球帶（拖曳旋轉、滾輪縮放、點軌跡播放）">
              {playerTraj.data && playerTraj.data.length > 0 ? (
                <StrikeZone3D pitches={playerTraj.data} height={620} />
              ) : locations.data && locations.data.length > 0 ? (
                <StrikeZone3D locations={locations.data} height={620} />
              ) : (
                <EmptyState text="沒有球路位置資料" />
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="spray" className="space-y-4">
            <SectionCard title={`擊球落點（${role === "pitcher" ? "對手對戰" : "本人擊球"}）`}>
              {spray.data && spray.data.length > 0 ? (
                <SprayChart data={spray.data} width={560} height={520} />
              ) : (
                <EmptyState text="沒有擊球落點資料" />
              )}
            </SectionCard>

            {battedBall.data && battedBall.data.n > 0 && (
              <SectionCard title="擊球類型分佈 Batted Ball Profile">
                <BattedBallPie data={battedBall.data} />
              </SectionCard>
            )}

            {contactProfile.data && contactProfile.data.length > 0 && (
              <SectionCard
                title="Contact Profile — 接觸點 / 擊球後 spin / 滯空"
                footer={
                  <>
                    接觸點 X = 前後（負值=本壘前=「打早」），Y = 高度（揮棒平面），Z = 側向。
                    擊球後 spin 高 = 揮棒切到球邊緣（易產生平飛 / 側旋飛球）；hang time 反映飛行軌跡的高度與距離。
                  </>
                }
              >
                <ContactProfile rows={contactProfile.data} />
              </SectionCard>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
