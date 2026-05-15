"""Parse a single player detail page into structured records.

The page embeds 7+ React-Query dehydrated entries:

* ``player-detail`` → bio block (height/weight/school/handedness/registration log)
* ``season-pr-table`` → league raw stats + percentile ranks (full leaderboard)
* ``player-pitch-tracking`` → pitch-type breakdown (pitchers only)
* ``player-logs`` → pitch-by-pitch Trackman records for this player's appearances
* ``summary`` → league-wide batted-ball / exit-velocity baselines
* ``players`` → roster snippet
* ``game / list / <date>`` → today's games

Heavyweight ``player-logs`` records are returned separately so callers can
choose whether to persist them.
"""
from __future__ import annotations

from typing import Any

from common import POSITION_MAP, extract_rsc_stream
from rsc_query import iter_queries


def _key0(qk: Any) -> str | None:
    if isinstance(qk, list) and qk and isinstance(qk[0], str):
        return qk[0]
    return None


def parse_player_page(player_id: str, html: str) -> dict:
    """Return structured records extracted from a player detail page.

    Output keys:
        bio:         flat dict with bio columns
        season:      dict with the player's row from season-pr-table, or None
        pr_table:    full season-pr-table (list of all players' rows)
        pitch_types: list of pitch-type rows from player-pitch-tracking
        logs:        list of pitch-by-pitch logs
        meta:        season-pr-table query metadata (year, searchType, gameKind)
    """
    stream = extract_rsc_stream(html)
    queries = {_key0(q.get("queryKey")): q for q in iter_queries(stream) if _key0(q.get("queryKey"))}

    bio = _parse_bio(player_id, queries.get("player-detail"))
    season_row, pr_table_full, pr_meta = _parse_season_pr(player_id, queries.get("season-pr-table"))
    pitch_types = _parse_pitch_tracking(player_id, queries.get("player-pitch-tracking"))
    logs = _parse_logs(queries.get("player-logs"))

    return {
        "bio": bio,
        "season": season_row,
        "pr_table": pr_table_full,
        "pitch_types": pitch_types,
        "logs": logs,
        "meta": pr_meta,
    }


_BIO_COLS = [
    "player_id", "name", "name_en", "aboriginal_name", "jersey_number",
    "image_url", "birthdate", "first_game_date", "height_cm", "weight_kg",
    "nationality", "school", "sex", "is_foreign", "is_aboriginal",
    "is_player", "is_coach", "is_referee", "player_status",
    "batting_hand", "throwing_hand", "position_code", "position_name",
    "team_code", "team_name", "team_logo", "remarks",
]


def _parse_bio(player_id: str, q: dict | None) -> dict:
    out = {c: None for c in _BIO_COLS}
    out["player_id"] = player_id
    if not q:
        return out
    basic = (((q.get("state") or {}).get("data") or {}).get("data") or {}) \
        .get("player", {}).get("basic", {}) or {}
    team = basic.get("team") or {}
    pos_code = str(basic.get("defendStation") or "")
    bd = (basic.get("birthDate") or "").split("T", 1)[0]
    fg = (basic.get("firstGameDate") or "").split("T", 1)[0]
    out.update({
        "name": basic.get("chName"),
        "name_en": basic.get("engname"),
        "aboriginal_name": basic.get("aboriginalName") or None,
        "jersey_number": basic.get("uniformNo"),
        "image_url": basic.get("acntImgPath"),
        "birthdate": bd or None,
        "first_game_date": fg or None,
        "height_cm": basic.get("height"),
        "weight_kg": basic.get("weight"),
        "nationality": basic.get("nation"),
        "school": basic.get("schoolName"),
        "sex": basic.get("sex"),
        "is_foreign": basic.get("isForeign"),
        "is_aboriginal": basic.get("isAboriginal"),
        "is_player": basic.get("isPlayer"),
        "is_coach": basic.get("isCoach"),
        "is_referee": basic.get("isReferee"),
        "player_status": basic.get("playerStatus") or None,
        "batting_hand": basic.get("strikeHabbit"),
        "throwing_hand": basic.get("pitchingHabbit"),
        "position_code": pos_code or None,
        "position_name": POSITION_MAP.get(pos_code, ""),
        "team_code": team.get("code"),
        "team_name": team.get("name"),
        "team_logo": team.get("bigLogoUrl"),
        "remarks": basic.get("rmk"),
    })
    return out


_PR_RENAME = {
    "pa": "pa",
    "woba": "woba", "wobaPr": "woba_pr",
    "ba": "ba", "baPr": "ba_pr",
    "slg": "slg", "slgPr": "slg_pr",
    "iso": "iso", "isoPr": "iso_pr",
    "obp": "obp", "obpPr": "obp_pr",
    "brl": "barrels", "brlPr": "barrels_pr",
    "brlp": "barrel_pct", "prlpPr": "barrel_pct_pr",
    "ev": "exit_velo_avg", "evPr": "exit_velo_avg_pr",
    "maxEv": "exit_velo_max", "maxEvPr": "exit_velo_max_pr",
    "hardHitp": "hard_hit_pct", "hardHitpPr": "hard_hit_pct_pr",
    "kp": "k_pct", "kpPr": "k_pct_pr",
    "bbp": "bb_pct", "bbpPr": "bb_pct_pr",
    "whiffp": "whiff_pct", "whiffpPr": "whiff_pct_pr",
    "chasep": "chase_pct", "chasepPr": "chase_pct_pr",
}


def _flatten_pr_row(row: dict) -> dict:
    player = row.get("player") or {}
    team = row.get("team") or {}
    flat = {
        "player_id": player.get("acnt"),
        "player_name": player.get("name"),
        "team_code": team.get("code") or None,
        "team_name": team.get("name") or None,
    }
    for src, dst in _PR_RENAME.items():
        if src in row:
            flat[dst] = row[src]
    return flat


def _parse_season_pr(player_id: str, q: dict | None) -> tuple[dict | None, list[dict], dict]:
    if not q:
        return None, [], {}
    qk = q.get("queryKey") or []
    meta = qk[1] if len(qk) > 1 and isinstance(qk[1], dict) else {}
    data = (q.get("state") or {}).get("data")
    if not isinstance(data, list):
        return None, [], meta
    rows = [_flatten_pr_row(r) for r in data if isinstance(r, dict)]
    me = next((r for r in rows if r.get("player_id") == player_id), None)
    return me, rows, meta


_PITCH_RENAME = {
    "pitchType": "pitch_type",
    "pitches": "pitches",
    "kph": "kph_avg", "kphMax": "kph_max",
    "spinRate": "spin_rpm_avg", "spinRateMax": "spin_rpm_max",
    "throws": "throws",
}


def _parse_pitch_tracking(player_id: str, q: dict | None) -> list[dict]:
    if not q:
        return []
    data = (q.get("state") or {}).get("data") or {}
    lb = data.get("leaderboard") if isinstance(data, dict) else None
    if not isinstance(lb, list):
        return []
    out = []
    for row in lb:
        player = (row or {}).get("player") or {}
        team = (row or {}).get("team") or {}
        if player.get("acnt") != player_id:
            continue
        flat = {
            "player_id": player.get("acnt"),
            "player_name": player.get("name"),
            "team_code": team.get("code") or None,
            "team_name": team.get("name") or None,
        }
        for src, dst in _PITCH_RENAME.items():
            if src in row:
                flat[dst] = row[src]
        out.append(flat)
    return out


def _parse_logs(q: dict | None) -> list[dict]:
    if not q:
        return []
    data = (q.get("state") or {}).get("data") or {}
    inner = data.get("data") if isinstance(data, dict) else None
    if not isinstance(inner, dict):
        return []
    logs = inner.get("logs")
    return logs if isinstance(logs, list) else []
