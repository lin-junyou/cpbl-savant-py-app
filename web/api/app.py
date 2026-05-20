"""FastAPI backend for the CPBL Savant-style analytics site.

All data is read directly from ``data/db/cpbl.sqlite`` produced by the
``scraper/`` and ``analysis/`` modules. No writes are ever performed.

Run::

    uvicorn web.api.app:app --reload --port 8000
"""
from __future__ import annotations

import json
import math
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DB = Path(__file__).resolve().parent.parent.parent / "data" / "db" / "cpbl.sqlite"

app = FastAPI(title="CPBL Stats API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def _rows(cur) -> list[dict]:
    cols = [c[0] for c in cur.description]
    return [
        {k: _clean(v) for k, v in zip(cols, row)}
        for row in cur.fetchall()
    ]


def _clean(v: Any) -> Any:
    """JSON-safe scalar cleanup (NaN/Inf → None)."""
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
    return v


@app.get("/api/health")
def health():
    with db() as conn:
        n = conn.execute("SELECT COUNT(*) FROM players").fetchone()[0]
    return {"ok": True, "players": n}


# ─── Players ────────────────────────────────────────────────────────────

@app.get("/api/players")
def list_players(
    q: str | None = None,
    team: str | None = None,
    position: str | None = None,
    division: str | None = Query(None, description="first | second"),
    limit: int = 500,
):
    where, params = ["1=1"], []
    if q:
        where.append("(name LIKE ? OR name_en LIKE ? OR player_id LIKE ?)")
        params += [f"%{q}%", f"%{q}%", f"%{q}%"]
    if team:
        where.append("team_name = ?")
        params.append(team)
    if position:
        where.append("position_code = ?")
        params.append(position)
    if division == "first":
        where.append("team_name NOT LIKE '%二軍'")
    elif division == "second":
        where.append("team_name LIKE '%二軍'")
    sql = (
        "SELECT player_id, name, name_en, team_name, team_code, "
        "position_code, position_name, jersey_number, image_url, "
        "batting_hand, throwing_hand, height_cm, weight_kg "
        "FROM players WHERE " + " AND ".join(where) +
        " ORDER BY team_name, jersey_number+0 LIMIT ?"
    )
    params.append(limit)
    with db() as conn:
        return _rows(conn.execute(sql, params))


@app.get("/api/players/{pid}")
def get_player(pid: str):
    with db() as conn:
        bio = conn.execute(
            "SELECT * FROM players WHERE player_id = ?", (pid,)
        ).fetchone()
        if not bio:
            raise HTTPException(404, f"player {pid} not found")
        bio_d = {k: _clean(bio[k]) for k in bio.keys()}

        season_row = conn.execute(
            "SELECT * FROM player_season WHERE player_id = ?", (pid,)
        ).fetchone()
        season = {k: _clean(season_row[k]) for k in season_row.keys()} if season_row else None

        pitch_rows = _rows(conn.execute(
            "SELECT * FROM pitch_tracking WHERE player_id = ? "
            "ORDER BY pitches DESC", (pid,)
        ))

        # Trackman repertoire from pitch-by-pitch
        trackman_rep = _rows(conn.execute(
            "SELECT auto_pitch_type, COUNT(*) AS pitches, "
            "AVG(rel_speed_kph) AS avg_kph, MAX(rel_speed_kph) AS max_kph, "
            "AVG(spin_rate) AS avg_spin, "
            "SUM(CASE WHEN pitch_call='StrikeSwinging' THEN 1 ELSE 0 END) AS whiffs, "
            "SUM(CASE WHEN pitch_call='StrikeCalled' THEN 1 ELSE 0 END) AS called_strikes, "
            "SUM(CASE WHEN pitch_call='BallCalled' THEN 1 ELSE 0 END) AS balls, "
            "SUM(CASE WHEN pitch_call IN ('InPlay','InPlayHit','InPlayOut') THEN 1 ELSE 0 END) AS in_play "
            "FROM trackman_pitches WHERE pitcher_acnt = ? "
            "GROUP BY auto_pitch_type ORDER BY pitches DESC",
            (pid,),
        ))

        # PR ranks (extracts the percentile columns from season)
        pr = {}
        if season:
            for k, v in season.items():
                if k.endswith("_pr") and v is not None:
                    pr[k] = v

    return {
        "bio": bio_d,
        "season": season,
        "pr": pr,
        "pitch_tracking": pitch_rows,
        "trackman_repertoire": trackman_rep,
    }


@app.get("/api/players/{pid}/locations")
def player_pitch_locations(pid: str, role: str = Query("pitcher")):
    """Pitch plate-crossing locations + release info for strike-zone heatmap."""
    col = "pitcher_acnt" if role == "pitcher" else "hitter_acnt"
    with db() as conn:
        return _rows(conn.execute(
            f"SELECT plate_loc_side, plate_loc_height, auto_pitch_type, "
            f"pitch_call, rel_speed_kph, spin_rate, "
            f"rel_side, rel_height, extension, "
            f"content, batting_action "
            f"FROM trackman_pitches WHERE {col} = ? "
            f"AND plate_loc_side IS NOT NULL AND plate_loc_height IS NOT NULL",
            (pid,),
        ))


@app.get("/api/players/{pid}/contact")
def player_contact(pid: str, role: str = Query("hitter")):
    """All batted-ball events with Trackman launch metrics.

    Used for EV vs LA scatter, EV / LA histograms, swing-take analysis.
    """
    col = "hitter_acnt" if role == "hitter" else "pitcher_acnt"
    with db() as conn:
        return _rows(conn.execute(
            f"SELECT hit_exit_speed_kph, hit_launch_angle, hit_direction, "
            f"land_bearing, land_distance_m, land_hang_time, "
            f"hit_spin_rate, auto_pitch_type, content, batting_action, "
            f"rel_speed_kph, plate_loc_side, plate_loc_height, "
            f"hitter_name, pitcher_name, field_name "
            f"FROM trackman_pitches WHERE {col} = ? "
            f"AND hit_exit_speed_kph IS NOT NULL",
            (pid,),
        ))


@app.get("/api/players/{pid}/zone-stats")
def player_zone_stats(pid: str, role: str = Query("hitter")):
    """3x3 strike-zone breakdown: pitches seen / swing / whiff / hit per cell."""
    col = "hitter_acnt" if role == "hitter" else "pitcher_acnt"
    with db() as conn:
        rows = _rows(conn.execute(
            f"SELECT plate_loc_side, plate_loc_height, pitch_call, content "
            f"FROM trackman_pitches WHERE {col} = ? "
            f"AND plate_loc_side IS NOT NULL AND plate_loc_height IS NOT NULL",
            (pid,),
        ))
    # 3x3 grid: cols (x) and rows (y) over the strike zone bounds.
    HW = 0.215
    TOP = 1.07
    BOT = 0.46
    cell_w = (2 * HW) / 3
    cell_h = (TOP - BOT) / 3
    grid = [[
        {"col": c, "row": r, "pitches": 0, "swings": 0, "whiffs": 0,
         "in_play": 0, "hits": 0}
        for c in range(3)
    ] for r in range(3)]
    swinging_calls = {"StrikeSwinging", "FoulBallNotFieldable", "InPlay",
                      "InPlayHit", "InPlayOut", "FoulTip"}
    for row in rows:
        x, y = row["plate_loc_side"], row["plate_loc_height"]
        # Flip x to catcher view for consistency
        cx = -x
        if cx < -HW or cx > HW or y < BOT or y > TOP:
            continue
        col_i = min(2, max(0, int((cx + HW) / cell_w)))
        # row 0 = bottom, row 2 = top
        row_i = min(2, max(0, int((y - BOT) / cell_h)))
        cell = grid[row_i][col_i]
        cell["pitches"] += 1
        pc = row["pitch_call"]
        if pc in swinging_calls:
            cell["swings"] += 1
        if pc == "StrikeSwinging":
            cell["whiffs"] += 1
        if pc in ("InPlay", "InPlayHit", "InPlayOut"):
            cell["in_play"] += 1
            content = row["content"] or ""
            if "安打" in content or "全壘打" in content:
                cell["hits"] += 1
    flat = [c for r in grid for c in r]
    return flat


@app.get("/api/players/{pid}/pitch-stats")
def player_pitch_stats(pid: str, role: str = Query("pitcher")):
    """Per-pitch-type aggregate: count, usage%, avg metrics, outcomes."""
    col = "pitcher_acnt" if role == "pitcher" else "hitter_acnt"
    with db() as conn:
        rows = _rows(conn.execute(
            f"SELECT auto_pitch_type, "
            f"COUNT(*) AS pitches, "
            f"AVG(rel_speed_kph) AS avg_kph, "
            f"MAX(rel_speed_kph) AS max_kph, "
            f"AVG(spin_rate) AS avg_spin, "
            f"SUM(CASE WHEN pitch_call='StrikeSwinging' THEN 1 ELSE 0 END) AS whiffs, "
            f"SUM(CASE WHEN pitch_call='StrikeCalled' THEN 1 ELSE 0 END) AS called_strikes, "
            f"SUM(CASE WHEN pitch_call='BallCalled' THEN 1 ELSE 0 END) AS balls, "
            f"SUM(CASE WHEN pitch_call IN ('InPlay','InPlayHit','InPlayOut') THEN 1 ELSE 0 END) AS in_play, "
            f"SUM(CASE WHEN content LIKE '%安打%' OR content LIKE '%全壘打%' THEN 1 ELSE 0 END) AS hits, "
            f"SUM(CASE WHEN content LIKE '%全壘打%' THEN 1 ELSE 0 END) AS home_runs, "
            f"AVG(hit_exit_speed_kph) AS avg_ev, "
            f"AVG(hit_launch_angle) AS avg_la "
            f"FROM trackman_pitches WHERE {col} = ? AND auto_pitch_type IS NOT NULL "
            f"GROUP BY auto_pitch_type ORDER BY pitches DESC",
            (pid,),
        ))
    total = sum(r["pitches"] for r in rows) or 1
    for r in rows:
        r["usage_pct"] = round(100 * r["pitches"] / total, 1)
        sw = r["whiffs"] + r["called_strikes"] + r["balls"] + r["in_play"]
        r["swing_pct"] = round(100 * (r["whiffs"] + r["in_play"]) / sw, 1) if sw else 0
        r["whiff_per_swing"] = (
            round(100 * r["whiffs"] / max(1, r["whiffs"] + r["in_play"]), 1)
        )
    return rows


@app.get("/api/players/{pid}/game-logs")
def player_game_logs(pid: str, role: str = Query("pitcher"), limit: int = 30):
    """Per-game stats for the most recent ``limit`` games."""
    table = "game_pitchers" if role == "pitcher" else "game_hitters"
    acnt_col = "pitcher_acnt" if role == "pitcher" else "hitter_acnt"
    with db() as conn:
        return _rows(conn.execute(
            f"SELECT * FROM {table} WHERE {acnt_col} = ? "
            f"ORDER BY date DESC, game_sno DESC LIMIT ?",
            (pid, limit),
        ))


@app.get("/api/players/{pid}/zone-woba")
def player_zone_woba(pid: str, role: str = Query("hitter")):
    """3x3 strike-zone wOBA / batting-average / slugging by zone."""
    col = "hitter_acnt" if role == "hitter" else "pitcher_acnt"
    with db() as conn:
        rows = _rows(conn.execute(
            f"SELECT plate_loc_side, plate_loc_height, pitch_call, content "
            f"FROM trackman_pitches WHERE {col} = ? "
            f"AND plate_loc_side IS NOT NULL AND plate_loc_height IS NOT NULL "
            f"AND pitch_call IN ('InPlay','InPlayHit','InPlayOut')",
            (pid,),
        ))
    HW = 0.215
    TOP = 1.07
    BOT = 0.46
    cell_w = (2 * HW) / 3
    cell_h = (TOP - BOT) / 3
    grid = [[
        {"col": c, "row": r, "ab": 0, "hits": 0, "tb": 0, "bb": 0,
         "pa": 0, "ba": 0.0, "slg": 0.0, "woba": 0.0}
        for c in range(3)
    ] for r in range(3)]
    # Linear weights (approximate wOBA weights):
    W = {"BB": 0.69, "1B": 0.89, "2B": 1.27, "3B": 1.62, "HR": 2.10}
    for row in rows:
        x, y = row["plate_loc_side"], row["plate_loc_height"]
        cx = -x  # flip to catcher view
        if cx < -HW or cx > HW or y < BOT or y > TOP:
            continue
        col_i = min(2, max(0, int((cx + HW) / cell_w)))
        row_i = min(2, max(0, int((y - BOT) / cell_h)))
        cell = grid[row_i][col_i]
        cell["pa"] += 1
        cell["ab"] += 1
        content = row["content"] or ""
        if "全壘打" in content:
            cell["hits"] += 1
            cell["tb"] += 4
            cell["woba"] += W["HR"]
        elif "三壘安打" in content:
            cell["hits"] += 1
            cell["tb"] += 3
            cell["woba"] += W["3B"]
        elif "二壘安打" in content:
            cell["hits"] += 1
            cell["tb"] += 2
            cell["woba"] += W["2B"]
        elif "安打" in content and "犧牲" not in content:
            cell["hits"] += 1
            cell["tb"] += 1
            cell["woba"] += W["1B"]
    flat = []
    for r in grid:
        for c in r:
            ab = c["ab"]
            if ab > 0:
                c["ba"] = round(c["hits"] / ab, 3)
                c["slg"] = round(c["tb"] / ab, 3)
                c["woba"] = round(c["woba"] / max(c["pa"], 1), 3)
            flat.append(c)
    return flat


@app.get("/api/players/{pid}/plate-discipline")
def player_plate_discipline(pid: str, role: str = Query("hitter"), bat_side: str = ""):
    """Detailed plate-discipline metrics, optionally split by RHB/LHB.

    For pitchers, ``bat_side`` filters by the OPPOSING batter's hand.
    """
    col = "hitter_acnt" if role == "hitter" else "pitcher_acnt"
    sql = (
        f"SELECT t.plate_loc_side, t.plate_loc_height, t.pitch_call, "
        f"t.auto_pitch_type, t.content, p.batting_hand "
        f"FROM trackman_pitches t "
        f"LEFT JOIN players p ON p.player_id = t.hitter_acnt "
        f"WHERE t.{col} = ? "
        f"AND t.plate_loc_side IS NOT NULL AND t.plate_loc_height IS NOT NULL"
    )
    params: list[Any] = [pid]
    if bat_side in ("L", "R"):
        sql += " AND p.batting_hand = ?"
        params.append(bat_side)
    with db() as conn:
        rows = _rows(conn.execute(sql, params))
    HW = 0.215
    TOP = 1.07
    BOT = 0.46
    swinging_calls = {"StrikeSwinging", "FoulBallNotFieldable", "InPlay",
                      "InPlayHit", "InPlayOut", "FoulTip"}
    contact_calls = {"FoulBallNotFieldable", "InPlay", "InPlayHit",
                     "InPlayOut", "FoulTip"}
    n = len(rows)
    in_zone_n = 0
    o_zone_n = 0
    swing_n = 0
    z_swing = 0
    o_swing = 0
    contact_n = 0
    z_contact = 0
    o_contact = 0
    whiff_n = 0
    edge_n = 0
    for r in rows:
        x = -(r["plate_loc_side"] or 0)
        y = r["plate_loc_height"] or 0
        in_zone = (-HW <= x <= HW) and (BOT <= y <= TOP)
        edge = abs(x) > HW * 0.7 or (y < BOT + 0.15) or (y > TOP - 0.15)
        if in_zone:
            in_zone_n += 1
        else:
            o_zone_n += 1
        if edge:
            edge_n += 1
        is_swing = r["pitch_call"] in swinging_calls
        if is_swing:
            swing_n += 1
            if in_zone:
                z_swing += 1
            else:
                o_swing += 1
            if r["pitch_call"] in contact_calls:
                contact_n += 1
                if in_zone:
                    z_contact += 1
                else:
                    o_contact += 1
            if r["pitch_call"] == "StrikeSwinging":
                whiff_n += 1
    pct = lambda a, b: round(100 * a / b, 1) if b else 0.0
    return {
        "pitches": n,
        "zone_pct": pct(in_zone_n, n),
        "edge_pct": pct(edge_n, n),
        "swing_pct": pct(swing_n, n),
        "z_swing_pct": pct(z_swing, in_zone_n),
        "o_swing_pct": pct(o_swing, o_zone_n),  # = chase
        "contact_pct": pct(contact_n, swing_n),
        "z_contact_pct": pct(z_contact, z_swing),
        "o_contact_pct": pct(o_contact, o_swing),
        "whiff_pct": pct(whiff_n, swing_n),
        "bat_side": bat_side or "all",
    }


@app.get("/api/players/{pid}/run-value")
def player_run_value(pid: str, role: str = Query("pitcher")):
    """Estimate per-pitch-type Run Value using linear-weight approximations.

    For each pitch the contribution is:
       BB → +0.31, K → -0.27 (or +0.27 for pitcher),
       1B → +0.47, 2B → +0.77, 3B → +1.04, HR → +1.40,
       Out (in play) → -0.25, BIP no-out → small +.
    Pitcher's RV = -1 × batter's RV.
    """
    col = "pitcher_acnt" if role == "pitcher" else "hitter_acnt"
    with db() as conn:
        rows = _rows(conn.execute(
            f"SELECT auto_pitch_type, pitch_call, content "
            f"FROM trackman_pitches WHERE {col} = ? "
            f"AND auto_pitch_type IS NOT NULL", (pid,),
        ))
    weights = {"BB": 0.31, "K": -0.27, "1B": 0.47, "2B": 0.77, "3B": 1.04,
               "HR": 1.40, "OUT": -0.25}
    by_type: dict[str, dict] = {}
    for r in rows:
        pt = r["auto_pitch_type"] or "Unknown"
        rec = by_type.setdefault(pt, {"pitch_type": pt, "pitches": 0, "rv_batter": 0.0})
        rec["pitches"] += 1
        # Only end-of-PA pitches contribute most to RV. Detect from content.
        c = (r["content"] or "")
        pc = r["pitch_call"]
        if "全壘打" in c:
            rec["rv_batter"] += weights["HR"]
        elif "三壘安打" in c:
            rec["rv_batter"] += weights["3B"]
        elif "二壘安打" in c:
            rec["rv_batter"] += weights["2B"]
        elif "安打" in c and "犧牲" not in c:
            rec["rv_batter"] += weights["1B"]
        elif "三振" in c or pc == "StrikeSwinging":
            # Approximation: each whiff contributes a fraction of K value.
            rec["rv_batter"] += weights["K"] * 0.25 if pc == "StrikeSwinging" else weights["K"]
        elif "保送" in c:
            rec["rv_batter"] += weights["BB"]
        elif "出局" in c or "刺殺" in c or "接殺" in c or "雙殺" in c:
            rec["rv_batter"] += weights["OUT"]
    out = []
    sign = -1 if role == "pitcher" else 1
    for rec in by_type.values():
        rv = sign * rec["rv_batter"]
        out.append({
            "pitch_type": rec["pitch_type"],
            "pitches": rec["pitches"],
            "run_value": round(rv, 2),
            "rv_per_100": round(100 * rv / max(1, rec["pitches"]), 2),
        })
    out.sort(key=lambda r: -r["run_value"])
    return out


@app.get("/api/players/{pid}/spin-distribution")
def player_spin_distribution(pid: str):
    """Per-pitch spin-direction distribution for each pitch type.

    Returns the full list of inferred spin directions (degrees, 0 = 12
    o'clock, increasing clockwise) so the frontend can draw a density arc
    on its clock-face card.
    """
    import json as _json
    import math
    with db() as conn:
        rows = _rows(conn.execute(
            "SELECT auto_pitch_type, traj_x, traj_y, traj_z, spin_rate "
            "FROM trackman_pitches WHERE pitcher_acnt = ? "
            "AND traj_x IS NOT NULL", (pid,),
        ))
    by_type: dict[str, dict] = {}
    for r in rows:
        try:
            tx = _json.loads(r["traj_x"])
            ty = _json.loads(r["traj_y"])
            tz = _json.loads(r["traj_z"])
        except (TypeError, _json.JSONDecodeError):
            continue
        a, b, c = tx[2], tx[1], tx[0]
        if a == 0:
            continue
        disc = b * b - 4 * a * c
        if disc < 0:
            continue
        sq = math.sqrt(disc)
        cands = [t for t in [(-b - sq) / (2 * a), (-b + sq) / (2 * a)] if 0.01 < t < 1.5]
        if not cands:
            continue
        t = min(cands)
        actual_y = ty[0] + ty[1] * t + ty[2] * t * t
        actual_z = tz[0] + tz[1] * t + tz[2] * t * t
        grav_y = ty[0] + ty[1] * t - 4.9 * t * t
        grav_z = tz[0] + tz[1] * t
        vert_m = actual_y - grav_y
        horiz_m = -(actual_z - grav_z)
        # Spin axis direction in catcher view: perpendicular to break.
        # axis vector = (0, -horiz, vert). Convert to clock-face degrees.
        ax_y, ax_z = -horiz_m, vert_m
        if abs(ax_y) + abs(ax_z) < 1e-4:
            continue
        deg = math.degrees(math.atan2(ax_z, ax_y))
        if deg < 0:
            deg += 360
        pt = r["auto_pitch_type"] or "Unknown"
        rec = by_type.setdefault(pt, {
            "pitch_type": pt, "directions": [], "spin_rates": [],
        })
        rec["directions"].append(round(deg, 1))
        if r["spin_rate"]:
            rec["spin_rates"].append(r["spin_rate"])
    out = []
    for rec in by_type.values():
        avg_spin = (
            sum(rec["spin_rates"]) / len(rec["spin_rates"])
            if rec["spin_rates"] else None
        )
        out.append({
            "pitch_type": rec["pitch_type"],
            "directions": rec["directions"],
            "count": len(rec["directions"]),
            "avg_spin": avg_spin,
        })
    out.sort(key=lambda r: -r["count"])
    return out


@app.get("/api/players/{pid}/movement")
def player_pitch_movement(pid: str):
    """Average per-pitch-type movement (horizontal + induced vertical break).

    Computed from the cached PolyFit coefficients in trackman_pitches:
    we evaluate each pitch's plate-crossing time, compare against a
    gravity-only projection, and aggregate by pitch type.
    """
    import json as _json
    import math
    with db() as conn:
        rows = _rows(conn.execute(
            "SELECT auto_pitch_type, traj_x, traj_y, traj_z, "
            "rel_speed_kph, spin_rate "
            "FROM trackman_pitches WHERE pitcher_acnt = ? "
            "AND traj_x IS NOT NULL", (pid,),
        ))
    by_type: dict[str, dict] = {}
    for r in rows:
        try:
            tx = _json.loads(r["traj_x"])
            ty = _json.loads(r["traj_y"])
            tz = _json.loads(r["traj_z"])
        except (TypeError, _json.JSONDecodeError):
            continue
        # Find plate crossing time (X(t) = 0)
        a, b, c = tx[2], tx[1], tx[0]
        if a == 0:
            continue
        disc = b * b - 4 * a * c
        if disc < 0:
            continue
        sq = math.sqrt(disc)
        cands = [t for t in [(-b - sq) / (2 * a), (-b + sq) / (2 * a)] if 0.01 < t < 1.5]
        if not cands:
            continue
        t = min(cands)
        # Actual position at plate
        actual_y = ty[0] + ty[1] * t + ty[2] * t * t
        actual_z = tz[0] + tz[1] * t + tz[2] * t * t
        # Gravity-only path (no magnus): use initial velocity from c1
        grav_y = ty[0] + ty[1] * t - 4.9 * t * t
        grav_z = tz[0] + tz[1] * t
        vert_m = actual_y - grav_y
        # Z is sign-flipped vs catcher view; horizontal break in catcher view:
        horiz_m = -(actual_z - grav_z)

        pt = r["auto_pitch_type"] or "Unknown"
        rec = by_type.setdefault(pt, {
            "pitch_type": pt, "count": 0,
            "horiz_sum": 0.0, "vert_sum": 0.0,
            "kph_sum": 0.0, "spin_sum": 0.0,
            "kph_n": 0, "spin_n": 0,
        })
        rec["count"] += 1
        rec["horiz_sum"] += horiz_m
        rec["vert_sum"] += vert_m
        if r["rel_speed_kph"] is not None:
            rec["kph_sum"] += r["rel_speed_kph"]
            rec["kph_n"] += 1
        if r["spin_rate"] is not None:
            rec["spin_sum"] += r["spin_rate"]
            rec["spin_n"] += 1

    out = []
    for rec in by_type.values():
        n = rec["count"]
        out.append({
            "pitch_type": rec["pitch_type"],
            "count": n,
            "horiz": rec["horiz_sum"] / n * 100,  # cm
            "vert": rec["vert_sum"] / n * 100,    # cm
            "avg_kph": rec["kph_sum"] / rec["kph_n"] if rec["kph_n"] else None,
            "spin": rec["spin_sum"] / rec["spin_n"] if rec["spin_n"] else None,
        })
    out.sort(key=lambda r: -r["count"])
    return out


@app.get("/api/players/{pid}/spray")
def player_spray(pid: str, role: str = Query("hitter")):
    col = "hitter_acnt" if role == "hitter" else "pitcher_acnt"
    with db() as conn:
        return _rows(conn.execute(
            f"SELECT land_bearing, land_distance_m, hit_exit_speed_kph, "
            f"hit_launch_angle, content, batting_action, field_name, "
            f"hitter_name, pitcher_name, auto_pitch_type "
            f"FROM trackman_pitches WHERE {col} = ? "
            f"AND land_distance_m IS NOT NULL",
            (pid,),
        ))


# ─── Leaderboards ───────────────────────────────────────────────────────

LEADERBOARD_TABLES = {
    "pr-batter": "rankings_pr_table_batter",
    "pr-pitcher": "rankings_pr_table_pitcher",
    "batted-ball-batter": "rankings_batted_ball_batter",
    "batted-ball-pitcher": "rankings_batted_ball_pitcher",
    "exit-velocity-batter": "rankings_exit_velocity_batter",
    "exit-velocity-pitcher": "rankings_exit_velocity_pitcher",
    "pitch-tracking": "rankings_pitch_tracking",
}


@app.get("/api/leaderboards/{board}")
def leaderboard(
    board: str,
    year: int = 2026,
    game_kind: str = "A",
    min_pa: int = 0,
    sort_by: str | None = None,
    asc: bool = False,
    limit: int = 200,
):
    if board not in LEADERBOARD_TABLES:
        raise HTTPException(404, f"unknown board {board}")
    table = LEADERBOARD_TABLES[board]
    where = ["year = ?", "game_kind = ?"]
    params: list[Any] = [year, game_kind]
    if min_pa:
        where.append("(pa IS NOT NULL AND pa >= ?)")
        params.append(min_pa)
    sql = f'SELECT * FROM "{table}" WHERE ' + " AND ".join(where)
    if sort_by:
        order = "ASC" if asc else "DESC"
        sql += f' ORDER BY "{sort_by}" {order} NULLS LAST'
    sql += " LIMIT ?"
    params.append(limit)
    with db() as conn:
        try:
            return _rows(conn.execute(sql, params))
        except sqlite3.OperationalError as e:
            raise HTTPException(400, str(e))


# ─── Stadium / spray ────────────────────────────────────────────────────

@app.get("/api/stadiums")
def stadiums():
    with db() as conn:
        return _rows(conn.execute(
            "SELECT field_name, field_no, COUNT(*) AS pitches, "
            "SUM(CASE WHEN land_distance_m IS NOT NULL THEN 1 ELSE 0 END) AS batted_balls, "
            "AVG(hit_exit_speed_kph) AS avg_ev, "
            "MAX(land_distance_m) AS max_distance "
            "FROM trackman_pitches WHERE field_name IS NOT NULL "
            "GROUP BY field_name, field_no ORDER BY pitches DESC"
        ))


@app.get("/api/stadiums/{name}/park-factors")
def stadium_park_factors(name: str):
    """League-relative park factors for HR / H / 2B / 3B / SO / BB.

    Park factor = (rate at this park) / (rate elsewhere) × 100. 100 = neutral,
    >100 = favours that outcome at this park.
    """
    with db() as conn:
        own = _rows(conn.execute(
            "SELECT content, hit_exit_speed_kph, hit_launch_angle, "
            "land_distance_m, pitch_call "
            "FROM trackman_pitches WHERE field_name = ?", (name,),
        ))
        other = _rows(conn.execute(
            "SELECT content, hit_exit_speed_kph, hit_launch_angle, "
            "land_distance_m, pitch_call "
            "FROM trackman_pitches WHERE field_name != ? AND field_name IS NOT NULL",
            (name,),
        ))
    def rates(rs):
        n = len(rs)
        if n == 0:
            return {}
        hr = sum(1 for r in rs if "全壘打" in (r["content"] or ""))
        b3 = sum(1 for r in rs if "三壘安打" in (r["content"] or ""))
        b2 = sum(1 for r in rs if "二壘安打" in (r["content"] or ""))
        b1 = sum(
            1 for r in rs if "安打" in (r["content"] or "")
            and not any(k in (r["content"] or "") for k in ("二壘", "三壘", "全壘打"))
        )
        bb = sum(1 for r in rs if r["pitch_call"] == "BallCalled")
        so_call = sum(1 for r in rs if r["pitch_call"] == "StrikeCalled")
        so_swing = sum(1 for r in rs if r["pitch_call"] == "StrikeSwinging")
        return {
            "n": n, "HR": hr, "3B": b3, "2B": b2, "1B": b1,
            "BB": bb, "K_called": so_call, "K_swing": so_swing,
        }
    own_r, other_r = rates(own), rates(other)
    if not own_r or not other_r:
        return {"factors": {}, "own": own_r, "other": other_r}
    factors = {}
    for k in ("HR", "3B", "2B", "1B", "BB", "K_called", "K_swing"):
        own_rate = own_r[k] / max(1, own_r["n"])
        other_rate = other_r[k] / max(1, other_r["n"])
        factors[k] = round(100 * own_rate / max(1e-9, other_rate), 1)
    # Avg EV and distance comparison
    own_ev = [r["hit_exit_speed_kph"] for r in own if r["hit_exit_speed_kph"] is not None]
    oth_ev = [r["hit_exit_speed_kph"] for r in other if r["hit_exit_speed_kph"] is not None]
    own_dist = [r["land_distance_m"] for r in own if r["land_distance_m"] is not None]
    oth_dist = [r["land_distance_m"] for r in other if r["land_distance_m"] is not None]
    factors["EV_avg"] = round(100 * (sum(own_ev) / max(1, len(own_ev))) / max(0.1, sum(oth_ev) / max(1, len(oth_ev))), 1) if own_ev and oth_ev else 100
    factors["Dist_avg"] = round(100 * (sum(own_dist) / max(1, len(own_dist))) / max(0.1, sum(oth_dist) / max(1, len(oth_dist))), 1) if own_dist and oth_dist else 100
    return {
        "factors": factors,
        "own_n": own_r["n"],
        "other_n": other_r["n"],
        "own_avg_ev": round(sum(own_ev) / max(1, len(own_ev)), 1) if own_ev else None,
        "other_avg_ev": round(sum(oth_ev) / max(1, len(oth_ev)), 1) if oth_ev else None,
        "own_avg_dist": round(sum(own_dist) / max(1, len(own_dist)), 1) if own_dist else None,
        "other_avg_dist": round(sum(oth_dist) / max(1, len(oth_dist)), 1) if oth_dist else None,
    }


@app.get("/api/stadiums/{name}/distributions")
def stadium_distributions(name: str):
    """EV / LA / distance distributions at this park for histograms."""
    with db() as conn:
        rows = _rows(conn.execute(
            "SELECT hit_exit_speed_kph AS ev, hit_launch_angle AS la, "
            "land_distance_m AS dist, content "
            "FROM trackman_pitches WHERE field_name = ? "
            "AND hit_exit_speed_kph IS NOT NULL", (name,),
        ))
    return {
        "ev": [r["ev"] for r in rows if r["ev"] is not None],
        "la": [r["la"] for r in rows if r["la"] is not None],
        "dist": [r["dist"] for r in rows if r["dist"] is not None],
        "n": len(rows),
    }


@app.get("/api/stadiums/{name}/hr-analysis")
def stadium_hr(name: str):
    """All HRs at this park with EV/LA/distance/direction."""
    with db() as conn:
        return _rows(conn.execute(
            "SELECT hitter_name, pitcher_name, "
            "hit_exit_speed_kph, hit_launch_angle, "
            "land_distance_m, land_bearing, content, date, auto_pitch_type "
            "FROM trackman_pitches WHERE field_name = ? "
            "AND content LIKE '%全壘打%' "
            "ORDER BY land_distance_m DESC",
            (name,),
        ))


@app.get("/api/stadiums/comparison")
def stadiums_comparison():
    """Bulk park-factor + summary stats for all stadiums."""
    with db() as conn:
        all_pitches = _rows(conn.execute(
            "SELECT field_name, content, hit_exit_speed_kph, "
            "land_distance_m, hit_launch_angle "
            "FROM trackman_pitches WHERE field_name IS NOT NULL"
        ))
    by_park: dict[str, dict] = {}
    for r in all_pitches:
        f = r["field_name"]
        rec = by_park.setdefault(f, {
            "field_name": f, "n": 0, "hr": 0, "hits": 0, "bb": 0,
            "ev_sum": 0.0, "ev_n": 0, "la_sum": 0.0, "la_n": 0,
            "dist_sum": 0.0, "dist_n": 0, "max_dist": 0,
        })
        rec["n"] += 1
        c = r["content"] or ""
        if "全壘打" in c:
            rec["hr"] += 1
        if "安打" in c:
            rec["hits"] += 1
        if r["hit_exit_speed_kph"] is not None:
            rec["ev_sum"] += r["hit_exit_speed_kph"]
            rec["ev_n"] += 1
        if r["hit_launch_angle"] is not None:
            rec["la_sum"] += r["hit_launch_angle"]
            rec["la_n"] += 1
        if r["land_distance_m"] is not None:
            rec["dist_sum"] += r["land_distance_m"]
            rec["dist_n"] += 1
            if r["land_distance_m"] > rec["max_dist"]:
                rec["max_dist"] = r["land_distance_m"]
    out = []
    for rec in by_park.values():
        out.append({
            "field_name": rec["field_name"],
            "pitches": rec["n"], "hr": rec["hr"],
            "hr_per_1000": round(1000 * rec["hr"] / max(1, rec["n"]), 2),
            "hits_per_1000": round(1000 * rec["hits"] / max(1, rec["n"]), 2),
            "avg_ev": round(rec["ev_sum"] / max(1, rec["ev_n"]), 1) if rec["ev_n"] else None,
            "avg_la": round(rec["la_sum"] / max(1, rec["la_n"]), 1) if rec["la_n"] else None,
            "avg_dist": round(rec["dist_sum"] / max(1, rec["dist_n"]), 1) if rec["dist_n"] else None,
            "max_dist": round(rec["max_dist"], 1),
        })
    out.sort(key=lambda r: -r["pitches"])
    return out


@app.get("/api/stadiums/{name}/density")
def stadium_density(name: str, grid: int = 30):
    """2D grid of batted-ball landing density (for KDE-style heatmap)."""
    import math
    with db() as conn:
        rows = _rows(conn.execute(
            "SELECT land_bearing AS b, land_distance_m AS d "
            "FROM trackman_pitches WHERE field_name = ? "
            "AND land_distance_m IS NOT NULL", (name,),
        ))
    cells = [[0] * grid for _ in range(grid)]
    L = 130  # half-width in meters
    for r in rows:
        b, d = r["b"], r["d"]
        rad = (b * math.pi) / 180
        x = d * math.sin(rad)
        y = d * math.cos(rad)
        # Map to grid: x ∈ [-L, L], y ∈ [-15, L+15]
        cx = int((x + L) / (2 * L) * grid)
        cy = int((y + 15) / (L + 30) * grid)
        if 0 <= cx < grid and 0 <= cy < grid:
            cells[cy][cx] += 1
    return {"grid": grid, "L": L, "cells": cells, "n": len(rows)}


@app.get("/api/stadiums/{name}/spray")
def stadium_spray(
    name: str,
    hits_only: bool = False,
    limit: int = 5000,
):
    where = ["field_name = ?", "land_distance_m IS NOT NULL"]
    params: list[Any] = [name]
    if hits_only:
        where.append(
            "(content LIKE '%安打%' OR content LIKE '%全壘打%')"
        )
    sql = (
        "SELECT land_bearing, land_distance_m, hit_exit_speed_kph, "
        "hit_launch_angle, content, batting_action, hitter_name, "
        "pitcher_name, auto_pitch_type, date, land_hang_time "
        "FROM trackman_pitches WHERE " + " AND ".join(where) + " LIMIT ?"
    )
    params.append(limit)
    with db() as conn:
        return _rows(conn.execute(sql, params))


# ─── Schedule / games ───────────────────────────────────────────────────

@app.get("/api/schedule")
def schedule(
    start: str | None = None,
    end: str | None = None,
    kind: str | None = None,
    limit: int = 500,
):
    where, params = ["1=1"], []
    if start:
        where.append("date >= ?")
        params.append(start)
    if end:
        where.append("date <= ?")
        params.append(end)
    if kind:
        where.append("kind_code = ?")
        params.append(kind)
    sql = (
        "SELECT * FROM schedule WHERE " + " AND ".join(where) +
        " ORDER BY date DESC, game_sno DESC LIMIT ?"
    )
    params.append(limit)
    with db() as conn:
        return _rows(conn.execute(sql, params))


@app.get("/api/games/{game_id}")
def game_detail(game_id: str):
    with db() as conn:
        sched = conn.execute(
            "SELECT * FROM schedule WHERE game_id = ?", (game_id,)
        ).fetchone()
        if not sched:
            raise HTTPException(404, f"game {game_id} not found")
        sched_d = {k: _clean(sched[k]) for k in sched.keys()}
        hitters = _rows(conn.execute(
            "SELECT * FROM game_hitters WHERE game_id = ? "
            "ORDER BY side, lineup", (game_id,)
        ))
        pitchers = _rows(conn.execute(
            "SELECT * FROM game_pitchers WHERE game_id = ? "
            "ORDER BY side, role_type DESC", (game_id,)
        ))
        innings = _rows(conn.execute(
            "SELECT * FROM inning_scores WHERE game_id = ? "
            "ORDER BY side, inning", (game_id,)
        ))
    return {"game": sched_d, "hitters": hitters,
            "pitchers": pitchers, "innings": innings}


# ─── Trajectory (3D pitch path) ─────────────────────────────────────────

@app.get("/api/trajectory/{game_id}")
def game_pitches(
    game_id: str,
    pitcher: str | None = None,
    pitch_type: str | None = None,
    limit: int = 200,
):
    """Return all pitches for a game with PolyFit coefficients.

    The frontend evaluates the quadratic in t to draw the path.
    """
    where = ["game_id = ?", "traj_x IS NOT NULL"]
    params: list[Any] = [game_id]
    if pitcher:
        where.append("pitcher_acnt = ?")
        params.append(pitcher)
    if pitch_type:
        where.append("auto_pitch_type = ?")
        params.append(pitch_type)
    sql = (
        "SELECT inning, out_cnt, ball_cnt, strike_cnt, pitch_cnt, "
        "pitcher_name, pitcher_acnt, hitter_name, hitter_acnt, "
        "auto_pitch_type, pitch_call, rel_speed_kph, spin_rate, "
        "plate_loc_side, plate_loc_height, "
        "traj_x, traj_y, traj_z "
        "FROM trackman_pitches WHERE " + " AND ".join(where) + " LIMIT ?"
    )
    params.append(limit)
    with db() as conn:
        rows = _rows(conn.execute(sql, params))
    # Parse the JSON-encoded coefficient arrays for the frontend
    for r in rows:
        for k in ("traj_x", "traj_y", "traj_z"):
            if r.get(k):
                try:
                    r[k] = json.loads(r[k])
                except json.JSONDecodeError:
                    r[k] = None
    return rows


# ─── Per-player 3D trajectory (used by player profile zone3d tab) ──────

@app.get("/api/players/{pid}/trajectory")
def player_trajectory(pid: str, role: str = Query("pitcher"), limit: int = 200):
    """Pitch trajectories across all games for a single player.

    Same shape as /api/trajectory/{game_id} so the frontend can reuse
    StrikeZone3D's `pitches` prop and the 3D experience matches the game view.
    """
    col = "pitcher_acnt" if role == "pitcher" else "hitter_acnt"
    sql = (
        "SELECT inning, out_cnt, ball_cnt, strike_cnt, pitch_cnt, "
        "pitcher_name, pitcher_acnt, hitter_name, hitter_acnt, "
        "auto_pitch_type, pitch_call, rel_speed_kph, spin_rate, "
        "plate_loc_side, plate_loc_height, "
        "traj_x, traj_y, traj_z "
        f"FROM trackman_pitches WHERE {col} = ? AND traj_x IS NOT NULL "
        "ORDER BY date DESC, game_id, pitch_cnt LIMIT ?"
    )
    with db() as conn:
        rows = _rows(conn.execute(sql, (pid, limit)))
    for r in rows:
        for k in ("traj_x", "traj_y", "traj_z"):
            if r.get(k):
                try:
                    r[k] = json.loads(r[k])
                except json.JSONDecodeError:
                    r[k] = None
    return rows


# ─── Teams (helper for filters) ─────────────────────────────────────────

@app.get("/api/players/{pid}/recent-form")
def player_recent_form(pid: str, role: str = Query("pitcher")):
    """Per-game rolling stats for the last 30 games."""
    if role == "pitcher":
        cols = (
            "date, game_id, era, whip, plate_appearances, "
            "strike_out_cnt, bases_onballs_cnt AS bb, earned_run_cnt, "
            "pitch_cnt, hitting_cnt AS hits, home_run_cnt, "
            "inning_pitched_cnt"
        )
        table, acnt = "game_pitchers", "pitcher_acnt"
    else:
        cols = (
            "date, game_id, plate_appearances, hitting_cnt AS ab, "
            "hit_cnt AS hits, home_run_cnt, "
            "two_base_hit_cnt, three_base_hit_cnt, "
            "bases_onballs_cnt AS bb, strike_out_cnt, "
            "run_batted_incnt AS rbi, score_cnt"
        )
        table, acnt = "game_hitters", "hitter_acnt"
    with db() as conn:
        rows = _rows(conn.execute(
            f"SELECT {cols} FROM {table} WHERE {acnt} = ? "
            f"ORDER BY date DESC, game_sno DESC LIMIT 30", (pid,),
        ))
    return list(reversed(rows))


@app.get("/api/players/{pid}/velocity-decline")
def player_velocity_decline(pid: str):
    """Pitch-by-pitch velocity within each game (for fatigue analysis)."""
    with db() as conn:
        rows = _rows(conn.execute(
            "SELECT game_id, date, pitch_cnt, rel_speed_kph, auto_pitch_type "
            "FROM trackman_pitches WHERE pitcher_acnt = ? "
            "AND rel_speed_kph IS NOT NULL "
            "ORDER BY date, game_id, pitch_cnt", (pid,),
        ))
    # Group by game; for each game return list of (pitch#, kph)
    games: dict[str, list[dict]] = {}
    for r in rows:
        gid = r["game_id"]
        games.setdefault(gid, []).append(r)
    return [
        {"game_id": gid, "date": pitches[0]["date"],
         "pitches": [
             {"pitch_cnt": p["pitch_cnt"], "kph": p["rel_speed_kph"],
              "pitch_type": p["auto_pitch_type"]}
             for p in pitches
         ]}
        for gid, pitches in games.items()
    ]


@app.get("/api/players/{pid}/batted-ball-profile")
def player_batted_ball(pid: str, role: str = Query("hitter")):
    """GB / LD / FB / PU + Pull / Center / Oppo distribution."""
    col = "hitter_acnt" if role == "hitter" else "pitcher_acnt"
    with db() as conn:
        rows = _rows(conn.execute(
            f"SELECT hit_launch_angle, land_bearing, content "
            f"FROM trackman_pitches WHERE {col} = ? "
            f"AND hit_exit_speed_kph IS NOT NULL", (pid,),
        ))
    types = {"GB": 0, "LD": 0, "FB": 0, "PU": 0}
    fields = {"Pull": 0, "Center": 0, "Oppo": 0}
    n = 0
    for r in rows:
        la = r["hit_launch_angle"]
        if la is None:
            continue
        n += 1
        if la < 10:
            types["GB"] += 1
        elif la < 25:
            types["LD"] += 1
        elif la < 50:
            types["FB"] += 1
        else:
            types["PU"] += 1
        bearing = r["land_bearing"]
        if bearing is not None:
            if bearing < -15:
                fields["Pull"] += 1
            elif bearing > 15:
                fields["Oppo"] += 1
            else:
                fields["Center"] += 1
    return {"n": n, "batted_ball_types": types, "field_distribution": fields}


@app.get("/api/players/{pid}/count-states")
def player_count_states(pid: str, role: str = Query("pitcher")):
    """Pitch-type usage by ball/strike count situation.

    Buckets:
      ahead    = 0-1 / 0-2 / 1-2
      behind   = 2-0 / 3-0 / 3-1
      even     = 0-0 / 1-1 / 2-2
      two_strk = anything with 2 strikes
    """
    col = "pitcher_acnt" if role == "pitcher" else "hitter_acnt"
    with db() as conn:
        rows = _rows(conn.execute(
            f"SELECT auto_pitch_type, ball_cnt, strike_cnt, pitch_call, content "
            f"FROM trackman_pitches WHERE {col} = ? AND auto_pitch_type IS NOT NULL",
            (pid,),
        ))
    def bucket(b: int, s: int) -> str:
        if s == 2: return "two_strk"
        if (b, s) in [(0, 1), (0, 2), (1, 2)]: return "ahead"
        if (b, s) in [(2, 0), (3, 0), (3, 1)]: return "behind"
        return "even"
    by_state: dict[str, dict[str, int]] = {}
    for r in rows:
        b = r.get("ball_cnt") or 0
        s = r.get("strike_cnt") or 0
        st = bucket(b, s)
        pt = r["auto_pitch_type"]
        by_state.setdefault(st, {})[pt] = by_state.setdefault(st, {}).get(pt, 0) + 1
    return by_state


@app.get("/api/standings")
def standings(year: int = 2026, kind: str = "A"):
    """Compute team standings from the schedule table."""
    with db() as conn:
        games = _rows(conn.execute(
            "SELECT visiting_team_name AS v, home_team_name AS h, "
            "visiting_score AS vs, home_score AS hs, game_status, kind_code, date "
            "FROM schedule WHERE kind_code = ? AND game_status='FINISHED' "
            "AND visiting_score IS NOT NULL AND home_score IS NOT NULL "
            "AND date LIKE ?", (kind, f"{year}%"),
        ))
    teams: dict[str, dict] = {}
    def get(t: str):
        return teams.setdefault(t, {
            "team": t, "w": 0, "l": 0, "t": 0, "rs": 0, "ra": 0,
            "last10_w": 0, "last10_l": 0, "recent": [],
        })
    # Sort by date so we can compute "last 10"
    games.sort(key=lambda g: g["date"])
    for g in games:
        v = get(g["v"])
        h = get(g["h"])
        vs, hs = g["vs"], g["hs"]
        v["rs"] += vs; v["ra"] += hs
        h["rs"] += hs; h["ra"] += vs
        if vs > hs:
            v["w"] += 1; h["l"] += 1
            v["recent"].append("W"); h["recent"].append("L")
        elif vs < hs:
            v["l"] += 1; h["w"] += 1
            v["recent"].append("L"); h["recent"].append("W")
        else:
            v["t"] += 1; h["t"] += 1
            v["recent"].append("T"); h["recent"].append("T")
    out = []
    for t in teams.values():
        gp = t["w"] + t["l"] + t["t"]
        pct = round(t["w"] / max(1, t["w"] + t["l"]), 3)
        # Pythagorean expected wins
        rs2 = t["rs"] ** 1.83
        ra2 = t["ra"] ** 1.83
        pyth = round(rs2 / max(1, rs2 + ra2), 3)
        last10 = t["recent"][-10:]
        l10w = last10.count("W")
        l10l = last10.count("L")
        out.append({
            "team": t["team"], "w": t["w"], "l": t["l"], "t": t["t"],
            "pct": pct, "rs": t["rs"], "ra": t["ra"],
            "diff": t["rs"] - t["ra"], "pyth": pyth,
            "last10": f"{l10w}-{l10l}", "gp": gp,
        })
    out.sort(key=lambda x: -x["pct"])
    if out:
        leader_w = out[0]["w"]
        leader_l = out[0]["l"]
        for t in out:
            t["gb"] = round(((leader_w - t["w"]) + (t["l"] - leader_l)) / 2, 1)
    return out


@app.get("/api/matchup")
def matchup(pitcher: str = Query(...), batter: str = Query(...)):
    """All trackman pitches between this pitcher × batter pair."""
    with db() as conn:
        rows = _rows(conn.execute(
            "SELECT auto_pitch_type, pitch_call, content, "
            "rel_speed_kph, plate_loc_side, plate_loc_height, "
            "hit_exit_speed_kph, hit_launch_angle, land_distance_m, "
            "date, game_id, inning, ball_cnt, strike_cnt "
            "FROM trackman_pitches "
            "WHERE pitcher_acnt = ? AND hitter_acnt = ? "
            "ORDER BY date, game_id, pitch_cnt", (pitcher, batter),
        ))
    # Aggregate
    n = len(rows)
    types: dict[str, int] = {}
    swings, whiffs, hits, hr = 0, 0, 0, 0
    for r in rows:
        if r["auto_pitch_type"]:
            types[r["auto_pitch_type"]] = types.get(r["auto_pitch_type"], 0) + 1
        pc = r["pitch_call"]
        if pc in ("StrikeSwinging", "FoulBallNotFieldable", "InPlay",
                  "InPlayHit", "InPlayOut", "FoulTip"):
            swings += 1
        if pc == "StrikeSwinging":
            whiffs += 1
        c = r.get("content") or ""
        if "安打" in c or "全壘打" in c:
            hits += 1
        if "全壘打" in c:
            hr += 1
    return {
        "n": n, "type_breakdown": types,
        "swings": swings, "whiffs": whiffs, "hits": hits, "hr": hr,
        "pitches": rows,
    }


@app.get("/api/league-leaders")
def league_leaders():
    """Mini leaderboards for the home page."""
    with db() as conn:
        def top(sql: str) -> list[dict]:
            return _rows(conn.execute(sql))
        return {
            "wOBA_first_batter": top(
                "SELECT s.player_id, s.player_name, s.team_name, s.woba "
                "FROM player_season s "
                "LEFT JOIN players p ON p.player_id = s.player_id "
                "WHERE s.team_name NOT LIKE '%二軍' "
                "AND p.position_code != '1' "
                "AND s.pa >= 80 "
                "ORDER BY s.woba DESC LIMIT 5"
            ),
            "Whiff_first_pitcher": top(
                "SELECT s.player_id, s.player_name, s.team_name, s.whiff_pct AS metric "
                "FROM player_season s "
                "LEFT JOIN players p ON p.player_id = s.player_id "
                "WHERE s.team_name NOT LIKE '%二軍' "
                "AND p.position_code = '1' "
                "AND s.pa >= 50 "
                "ORDER BY s.whiff_pct DESC LIMIT 5"
            ),
            "EVmax_batter": top(
                "SELECT s.player_id, s.player_name, s.team_name, s.exit_velo_max AS metric "
                "FROM player_season s "
                "WHERE s.exit_velo_max IS NOT NULL "
                "ORDER BY s.exit_velo_max DESC LIMIT 5"
            ),
            "Barrel_batter": top(
                "SELECT s.player_id, s.player_name, s.team_name, s.barrels AS metric "
                "FROM player_season s "
                "LEFT JOIN players p ON p.player_id = s.player_id "
                "WHERE s.team_name NOT LIKE '%二軍' "
                "AND p.position_code != '1' "
                "AND s.pa >= 50 "
                "ORDER BY s.barrels DESC LIMIT 5"
            ),
        }


@app.get("/api/players/{pid}/pitch-physics")
def player_pitch_physics(pid: str):
    """Per-pitch-type physics: extension, approach angles, velocity drop.

    These are the Trackman fields that most directly drive "perceived"
    fastball quality (longer extension + steeper VAA = harder to barrel).
    """
    with db() as conn:
        rows = _rows(conn.execute(
            "SELECT auto_pitch_type, "
            "AVG(extension) AS ext_avg, MAX(extension) AS ext_max, "
            "AVG(rel_speed_kph) AS rel_kph, AVG(zone_speed_kph) AS zone_kph, "
            "AVG(rel_speed_kph - zone_speed_kph) AS velo_drop, "
            "AVG(vert_appr_angle) AS vaa_avg, AVG(horz_appr_angle) AS haa_avg, "
            "COUNT(*) AS pitches "
            "FROM trackman_pitches WHERE pitcher_acnt = ? "
            "AND auto_pitch_type IS NOT NULL "
            "AND extension IS NOT NULL AND zone_speed_kph IS NOT NULL "
            "GROUP BY auto_pitch_type ORDER BY pitches DESC", (pid,),
        ))
    return rows


@app.get("/api/players/{pid}/contact-profile")
def player_contact_profile(pid: str, role: str = Query("hitter")):
    """3D contact position + hit-spin + hang-time per batted ball."""
    col = "hitter_acnt" if role == "hitter" else "pitcher_acnt"
    with db() as conn:
        return _rows(conn.execute(
            f"SELECT contact_x, contact_y, contact_z, "
            f"hit_spin_rate, hit_exit_speed_kph, hit_launch_angle, "
            f"land_distance_m, land_hang_time, content, auto_pitch_type "
            f"FROM trackman_pitches WHERE {col} = ? "
            f"AND contact_x IS NOT NULL", (pid,),
        ))


@app.get("/api/players/{pid}/pitch-grades")
def player_pitch_grades(pid: str):
    """Per-pitch-type Stuff+ / Command+ style grades.

    Stuff+   = standardised composite of velocity, spin, induced break.
    Command+ = standardised based on plate-zone% and edge%.
    Both scaled so league average = 100, std dev = 10.
    """
    import math
    with db() as conn:
        # League per-type stats
        league = {r["pitch_type"]: r for r in _rows(conn.execute(
            "SELECT auto_pitch_type AS pitch_type, "
            "AVG(rel_speed_kph) AS kph_mean, "
            "AVG(spin_rate) AS spin_mean "
            "FROM trackman_pitches WHERE auto_pitch_type IS NOT NULL "
            "GROUP BY auto_pitch_type"
        ))}
        # Player per-type stats
        pl = _rows(conn.execute(
            "SELECT auto_pitch_type AS pitch_type, "
            "COUNT(*) AS n, "
            "AVG(rel_speed_kph) AS kph, "
            "AVG(spin_rate) AS spin, "
            "AVG(plate_loc_height) AS h, "
            "AVG(ABS(plate_loc_side)) AS s "
            "FROM trackman_pitches WHERE pitcher_acnt = ? "
            "AND auto_pitch_type IS NOT NULL "
            "GROUP BY auto_pitch_type", (pid,),
        ))
    out = []
    for r in pl:
        pt = r["pitch_type"]
        lg = league.get(pt) or {}
        # Velocity z = (player − league) / 5 (kph)
        kph_z = ((r["kph"] or 0) - (lg.get("kph_mean") or 0)) / 5.0
        spin_z = ((r["spin"] or 0) - (lg.get("spin_mean") or 0)) / 200.0
        stuff = 100 + (kph_z + spin_z) * 10
        # Command grade based on zone consistency (lower edge variance better)
        cmd = 100 - (r.get("s") or 0) * 30  # rough proxy
        out.append({
            "pitch_type": pt,
            "pitches": r["n"],
            "stuff_plus": round(stuff, 1),
            "command_plus": round(max(60, min(140, cmd)), 1),
            "kph": round(r["kph"] or 0, 1),
            "spin": round(r["spin"] or 0),
        })
    out.sort(key=lambda x: -x["pitches"])
    return out


@app.get("/api/predict/xwoba")
def predict_xwoba(role: str = Query("batter"), division: str = "first",
                  min_pa: int = 30):
    """xwOBA ridge model + Bayesian shrinkage projection.

    Mirrors ``analysis/predict.py``.
    """
    import numpy as np
    import pandas as pd
    with db() as conn:
        bio = pd.read_sql(
            "SELECT player_id, name, team_name, position_code FROM players",
            conn,
        )
        season = pd.read_sql("SELECT * FROM player_season", conn)
    season = season.drop(
        columns=["player_name", "team_name", "team_code"], errors="ignore",
    )
    df = bio.merge(season, on="player_id", how="inner")
    if role == "batter":
        df = df[df["position_code"] != "1"]
    elif role == "pitcher":
        df = df[df["position_code"] == "1"]
    if division == "first":
        df = df[~df["team_name"].fillna("").str.contains("二軍")]
    elif division == "second":
        df = df[df["team_name"].fillna("").str.contains("二軍")]

    FEATURES = [
        "bb_pct", "k_pct", "whiff_pct", "chase_pct",
        "hard_hit_pct", "barrel_pct",
        "exit_velo_avg", "exit_velo_max",
    ]
    train = df.dropna(subset=FEATURES + ["woba"])
    train = train[train["pa"] >= min_pa]
    if len(train) < 30:
        return {"rows": [], "rmse": None, "n_train": len(train)}
    X = train[FEATURES].to_numpy(dtype=float)
    y = train["woba"].to_numpy(dtype=float)
    mu, sd = X.mean(axis=0), X.std(axis=0).clip(min=1e-9)
    Xs = (X - mu) / sd
    p = Xs.shape[1]
    A = Xs.T @ Xs + 1.0 * np.eye(p)
    b = Xs.T @ (y - y.mean())
    w_std = np.linalg.solve(A, b)
    w_orig = w_std / sd
    intercept = float(y.mean()) - float(np.sum(w_std * mu / sd))
    # Apply
    df_use = df.dropna(subset=FEATURES + ["woba", "pa"]).copy()
    df_use["xwoba"] = (
        intercept + (df_use[FEATURES].to_numpy(dtype=float) * w_orig).sum(axis=1)
    )
    df_use["delta"] = df_use["woba"] - df_use["xwoba"]
    league_x = float(df_use["xwoba"].mean())
    df_use["proj_woba"] = (
        df_use["woba"].fillna(league_x) * df_use["pa"].fillna(0)
        + df_use["xwoba"].fillna(league_x) * 100
    ) / (df_use["pa"].fillna(0) + 100)
    # 5-fold cv RMSE
    rng = np.random.default_rng(7)
    idx = rng.permutation(len(Xs))
    folds = np.array_split(idx, 5)
    errs = []
    for k in range(5):
        ti = folds[k]
        tri = np.concatenate([folds[i] for i in range(5) if i != k])
        Xt = Xs[tri]; yt = y[tri]
        At = Xt.T @ Xt + 1.0 * np.eye(p)
        bt = Xt.T @ (yt - yt.mean())
        wk = np.linalg.solve(At, bt)
        pred = Xs[ti] @ wk + yt.mean()
        errs.append(float(np.sqrt(np.mean((pred - y[ti]) ** 2))))
    rmse = float(np.mean(errs))
    out_rows = (
        df_use[df_use["pa"] >= min_pa][[
            "player_id", "name", "team_name", "pa", "woba", "xwoba",
            "delta", "proj_woba",
        ]]
        .sort_values("proj_woba", ascending=False)
        .to_dict(orient="records")
    )
    return {"rows": out_rows, "rmse": rmse, "n_train": int(len(train)),
            "coefs": dict(zip(FEATURES, [float(c) for c in w_orig]))}


@app.get("/api/teams/{code}")
def team_detail(code: str):
    with db() as conn:
        team = conn.execute(
            "SELECT team_code, team_name, COUNT(*) AS players "
            "FROM players WHERE team_code = ? GROUP BY team_code, team_name",
            (code,),
        ).fetchone()
        if not team:
            raise HTTPException(404, f"team {code} not found")
        players = _rows(conn.execute(
            "SELECT player_id, name, name_en, position_code, position_name, "
            "jersey_number, image_url, batting_hand, throwing_hand "
            "FROM players WHERE team_code = ? ORDER BY position_code, jersey_number+0",
            (code,),
        ))
        # Aggregate season stats
        leaders = _rows(conn.execute(
            "SELECT s.player_id, s.player_name, s.pa, s.woba, s.k_pct, s.bb_pct, "
            "p.position_code, p.position_name "
            "FROM player_season s LEFT JOIN players p ON p.player_id = s.player_id "
            "WHERE s.team_code = ? ORDER BY s.pa DESC LIMIT 50",
            (code,),
        ))
    return {
        "team_code": team["team_code"],
        "team_name": team["team_name"],
        "players": players,
        "leaders": leaders,
    }


@app.get("/api/teams")
def teams():
    with db() as conn:
        return _rows(conn.execute(
            "SELECT team_code, team_name, COUNT(*) AS players "
            "FROM players WHERE team_name IS NOT NULL "
            "GROUP BY team_code, team_name ORDER BY players DESC"
        ))
