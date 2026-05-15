export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

// ─── Types ────────────────────────────────────────────────────────────

export interface PlayerListItem {
  player_id: string;
  name: string | null;
  name_en: string | null;
  team_name: string | null;
  team_code: string | null;
  position_code: string | null;
  position_name: string | null;
  jersey_number: string | null;
  image_url: string | null;
  batting_hand: string | null;
  throwing_hand: string | null;
  height_cm: number | null;
  weight_kg: number | null;
}

export interface PlayerProfile {
  bio: Record<string, unknown> & {
    player_id: string;
    name: string | null;
    name_en: string | null;
    team_name: string | null;
    image_url: string | null;
  };
  season: Record<string, number | string | null> | null;
  pr: Record<string, number>;
  pitch_tracking: Array<Record<string, number | string | null>>;
  trackman_repertoire: Array<{
    auto_pitch_type: string | null;
    pitches: number;
    avg_kph: number | null;
    max_kph: number | null;
    avg_spin: number | null;
    whiffs: number;
    called_strikes: number;
    balls: number;
    in_play: number;
  }>;
}

export interface PitchLocation {
  plate_loc_side: number;
  plate_loc_height: number;
  auto_pitch_type: string | null;
  pitch_call: string | null;
  rel_speed_kph: number | null;
  spin_rate?: number | null;
  rel_side?: number | null;
  rel_height?: number | null;
  extension?: number | null;
  content?: string | null;
  batting_action?: string | null;
}

export interface ContactEvent {
  hit_exit_speed_kph: number;
  hit_launch_angle: number | null;
  hit_direction: number | null;
  land_bearing: number | null;
  land_distance_m: number | null;
  land_hang_time: number | null;
  hit_spin_rate: number | null;
  auto_pitch_type: string | null;
  content: string | null;
  batting_action: string | null;
  rel_speed_kph: number | null;
  plate_loc_side: number | null;
  plate_loc_height: number | null;
  hitter_name?: string | null;
  pitcher_name?: string | null;
  field_name?: string | null;
}

export interface ZoneCell {
  col: number;
  row: number;
  pitches: number;
  swings: number;
  whiffs: number;
  in_play: number;
  hits: number;
}

export interface PitchStat {
  auto_pitch_type: string;
  pitches: number;
  avg_kph: number | null;
  max_kph: number | null;
  avg_spin: number | null;
  whiffs: number;
  called_strikes: number;
  balls: number;
  in_play: number;
  hits: number;
  home_runs: number;
  avg_ev: number | null;
  avg_la: number | null;
  usage_pct: number;
  swing_pct: number;
  whiff_per_swing: number;
}

export interface SprayPoint {
  land_bearing: number;
  land_distance_m: number;
  hit_exit_speed_kph: number | null;
  hit_launch_angle: number | null;
  content: string | null;
  batting_action: string | null;
  field_name?: string | null;
  hitter_name?: string | null;
  pitcher_name?: string | null;
  auto_pitch_type?: string | null;
  date?: string | null;
}

export interface Stadium {
  field_name: string;
  field_no: string;
  pitches: number;
  batted_balls: number;
  avg_ev: number | null;
  max_distance: number | null;
}

export interface ScheduleRow {
  game_id: string;
  date: string;
  game_status: string;
  kind_code: string;
  visiting_team_name: string;
  home_team_name: string;
  visiting_score: number | null;
  home_score: number | null;
  field_name: string | null;
  winning_pitcher_name: string | null;
  loser_pitcher_name: string | null;
}

export interface TrajectoryPitch {
  inning: number | null;
  out_cnt: number | null;
  ball_cnt: number | null;
  strike_cnt: number | null;
  pitch_cnt: number | null;
  pitcher_name: string | null;
  pitcher_acnt: string | null;
  hitter_name: string | null;
  hitter_acnt: string | null;
  auto_pitch_type: string | null;
  pitch_call: string | null;
  rel_speed_kph: number | null;
  spin_rate: number | null;
  plate_loc_side: number | null;
  plate_loc_height: number | null;
  traj_x: [number, number, number] | null;
  traj_y: [number, number, number] | null;
  traj_z: [number, number, number] | null;
}

// ─── API calls ────────────────────────────────────────────────────────

export const api = {
  health: () => get<{ ok: boolean; players: number }>("/api/health"),
  players: (params: { q?: string; team?: string; division?: string }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.team) qs.set("team", params.team);
    if (params.division) qs.set("division", params.division);
    return get<PlayerListItem[]>(`/api/players?${qs}`);
  },
  player: (pid: string) => get<PlayerProfile>(`/api/players/${pid}`),
  playerLocations: (pid: string, role = "pitcher") =>
    get<PitchLocation[]>(`/api/players/${pid}/locations?role=${role}`),
  playerSpray: (pid: string, role = "hitter") =>
    get<SprayPoint[]>(`/api/players/${pid}/spray?role=${role}`),
  playerMovement: (pid: string) =>
    get<Array<{
      pitch_type: string;
      count: number;
      horiz: number;
      vert: number;
      avg_kph: number | null;
      spin: number | null;
    }>>(`/api/players/${pid}/movement`),
  playerContact: (pid: string, role = "hitter") =>
    get<ContactEvent[]>(`/api/players/${pid}/contact?role=${role}`),
  playerZoneStats: (pid: string, role = "hitter") =>
    get<ZoneCell[]>(`/api/players/${pid}/zone-stats?role=${role}`),
  playerPitchStats: (pid: string, role = "pitcher") =>
    get<PitchStat[]>(`/api/players/${pid}/pitch-stats?role=${role}`),
  playerGameLogs: (pid: string, role = "pitcher", limit = 30) =>
    get<Array<Record<string, number | string | null>>>(
      `/api/players/${pid}/game-logs?role=${role}&limit=${limit}`,
    ),
  playerZoneWoba: (pid: string, role = "hitter") =>
    get<Array<{
      col: number; row: number; ab: number; hits: number; tb: number;
      bb: number; pa: number; ba: number; slg: number; woba: number;
    }>>(`/api/players/${pid}/zone-woba?role=${role}`),
  playerPlateDiscipline: (pid: string, role = "hitter", batSide = "") =>
    get<{
      pitches: number;
      zone_pct: number; edge_pct: number;
      swing_pct: number; z_swing_pct: number; o_swing_pct: number;
      contact_pct: number; z_contact_pct: number; o_contact_pct: number;
      whiff_pct: number; bat_side: string;
    }>(`/api/players/${pid}/plate-discipline?role=${role}${batSide ? `&bat_side=${batSide}` : ""}`),
  playerRunValue: (pid: string, role = "pitcher") =>
    get<Array<{
      pitch_type: string; pitches: number;
      run_value: number; rv_per_100: number;
    }>>(`/api/players/${pid}/run-value?role=${role}`),
  playerSpinDistribution: (pid: string) =>
    get<Array<{
      pitch_type: string;
      directions: number[];
      count: number;
      avg_spin: number | null;
    }>>(`/api/players/${pid}/spin-distribution`),
  leaderboard: (
    board: string,
    params: { sort_by?: string; min_pa?: number; asc?: boolean; limit?: number } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.sort_by) qs.set("sort_by", params.sort_by);
    if (params.min_pa) qs.set("min_pa", String(params.min_pa));
    if (params.asc) qs.set("asc", "true");
    if (params.limit) qs.set("limit", String(params.limit));
    return get<Record<string, unknown>[]>(`/api/leaderboards/${board}?${qs}`);
  },
  stadiums: () => get<Stadium[]>("/api/stadiums"),
  stadiumParkFactors: (name: string) =>
    get<{
      factors: Record<string, number>;
      own_n: number; other_n: number;
      own_avg_ev: number | null; other_avg_ev: number | null;
      own_avg_dist: number | null; other_avg_dist: number | null;
    }>(`/api/stadiums/${encodeURIComponent(name)}/park-factors`),
  stadiumDistributions: (name: string) =>
    get<{ ev: number[]; la: number[]; dist: number[]; n: number }>(
      `/api/stadiums/${encodeURIComponent(name)}/distributions`,
    ),
  stadiumHRs: (name: string) =>
    get<Array<{
      hitter_name: string | null; pitcher_name: string | null;
      hit_exit_speed_kph: number | null; hit_launch_angle: number | null;
      land_distance_m: number | null; land_bearing: number | null;
      content: string | null; date: string; auto_pitch_type: string | null;
    }>>(`/api/stadiums/${encodeURIComponent(name)}/hr-analysis`),
  stadiumsComparison: () =>
    get<Array<{
      field_name: string; pitches: number; hr: number;
      hr_per_1000: number; hits_per_1000: number;
      avg_ev: number | null; avg_la: number | null;
      avg_dist: number | null; max_dist: number;
    }>>(`/api/stadiums/comparison`),
  stadiumDensity: (name: string, grid = 30) =>
    get<{ grid: number; L: number; cells: number[][]; n: number }>(
      `/api/stadiums/${encodeURIComponent(name)}/density?grid=${grid}`,
    ),
  stadiumSpray: (name: string, hitsOnly = false) =>
    get<SprayPoint[]>(
      `/api/stadiums/${encodeURIComponent(name)}/spray?hits_only=${hitsOnly}`,
    ),
  schedule: (params: { start?: string; end?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.start) qs.set("start", params.start);
    if (params.end) qs.set("end", params.end);
    if (params.limit) qs.set("limit", String(params.limit));
    return get<ScheduleRow[]>(`/api/schedule?${qs}`);
  },
  game: (gameId: string) =>
    get<{
      game: ScheduleRow & Record<string, unknown>;
      hitters: Array<Record<string, number | string | null>>;
      pitchers: Array<Record<string, number | string | null>>;
      innings: Array<Record<string, number | string | null>>;
    }>(`/api/games/${gameId}`),
  trajectory: (gameId: string, pitcher?: string) => {
    const qs = new URLSearchParams();
    if (pitcher) qs.set("pitcher", pitcher);
    qs.set("limit", "300");
    return get<TrajectoryPitch[]>(`/api/trajectory/${gameId}?${qs}`);
  },
  teams: () =>
    get<Array<{ team_code: string; team_name: string; players: number }>>(
      "/api/teams",
    ),
  playerRecentForm: (pid: string, role = "pitcher") =>
    get<Array<Record<string, number | string | null>>>(
      `/api/players/${pid}/recent-form?role=${role}`,
    ),
  playerVelocityDecline: (pid: string) =>
    get<Array<{
      game_id: string; date: string;
      pitches: Array<{ pitch_cnt: number; kph: number; pitch_type: string | null }>;
    }>>(`/api/players/${pid}/velocity-decline`),
  playerBattedBall: (pid: string, role = "hitter") =>
    get<{
      n: number;
      batted_ball_types: Record<"GB" | "LD" | "FB" | "PU", number>;
      field_distribution: Record<"Pull" | "Center" | "Oppo", number>;
    }>(`/api/players/${pid}/batted-ball-profile?role=${role}`),
  playerCountStates: (pid: string, role = "pitcher") =>
    get<Record<string, Record<string, number>>>(
      `/api/players/${pid}/count-states?role=${role}`,
    ),
  standings: (year = 2026, kind = "A") =>
    get<Array<{
      team: string; w: number; l: number; t: number;
      pct: number; rs: number; ra: number; diff: number;
      pyth: number; last10: string; gp: number; gb: number;
    }>>(`/api/standings?year=${year}&kind=${kind}`),
  matchup: (pitcher: string, batter: string) =>
    get<{
      n: number;
      type_breakdown: Record<string, number>;
      swings: number; whiffs: number; hits: number; hr: number;
      pitches: Array<Record<string, number | string | null>>;
    }>(`/api/matchup?pitcher=${pitcher}&batter=${batter}`),
  leagueLeaders: () =>
    get<Record<string, Array<Record<string, number | string | null>>>>(
      `/api/league-leaders`,
    ),
  playerPitchPhysics: (pid: string) =>
    get<Array<{
      auto_pitch_type: string; pitches: number;
      ext_avg: number | null; ext_max: number | null;
      rel_kph: number | null; zone_kph: number | null;
      velo_drop: number | null;
      vaa_avg: number | null; haa_avg: number | null;
    }>>(`/api/players/${pid}/pitch-physics`),
  playerContactProfile: (pid: string, role = "hitter") =>
    get<Array<{
      contact_x: number; contact_y: number; contact_z: number;
      hit_spin_rate: number | null;
      hit_exit_speed_kph: number | null;
      hit_launch_angle: number | null;
      land_distance_m: number | null;
      land_hang_time: number | null;
      content: string | null;
      auto_pitch_type: string | null;
    }>>(`/api/players/${pid}/contact-profile?role=${role}`),
  playerPitchGrades: (pid: string) =>
    get<Array<{
      pitch_type: string; pitches: number;
      stuff_plus: number; command_plus: number; kph: number; spin: number;
    }>>(`/api/players/${pid}/pitch-grades`),
  predictXwoba: (params: {
    role?: string; division?: string; min_pa?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.role) qs.set("role", params.role);
    if (params.division) qs.set("division", params.division);
    if (params.min_pa) qs.set("min_pa", String(params.min_pa));
    return get<{
      rows: Array<{
        player_id: string; name: string; team_name: string;
        pa: number; woba: number; xwoba: number; delta: number;
        proj_woba: number;
      }>;
      rmse: number | null;
      n_train: number;
      coefs: Record<string, number>;
    }>(`/api/predict/xwoba?${qs}`);
  },
  team: (code: string) =>
    get<{
      team_code: string;
      team_name: string;
      players: PlayerListItem[];
      leaders: Array<Record<string, number | string | null>>;
    }>(`/api/teams/${code}`),
};
