"""Crawl all rankings tables via the /api/proxy backend.

Covers four leaderboards × {batter, pitcher} × {一軍 A, 二軍 D}::

    pr-table         — wOBA, BA, OBP, SLG, ISO, K%, BB%, whiff%, chase%,
                       barrel%, exit velo avg/max, hard hit%
    batted-ball      — GB%, FB%, LD%, PU%, pull/center/oppo% (incl. by GB/Air)
    exit-velocity    — LA avg, sweet-spot%, EV avg/max/50th/90th, distance
    pitch-tracking   — by pitch type: pitches, kph/spin avg & max

Backend only returns 2026 data; older years are not stored.
"""
from __future__ import annotations

import argparse
import csv
import json
import sqlite3
import sys
import time
from pathlib import Path

from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import DATA_DIR
import api as cpbl_api

RANKINGS_DIR = DATA_DIR / "raw" / "rankings"
CSV_DIR = DATA_DIR / "csv"
DB_PATH = DATA_DIR / "db" / "cpbl.sqlite"

# (endpoint_name, callable, search_type|None) — pitch-tracking has no
# searchType because it's pitcher-only by design.
ENDPOINTS = [
    ("pr_table_batter", lambda y, gk: cpbl_api.pr_table(y, "batter", gk)),
    ("pr_table_pitcher", lambda y, gk: cpbl_api.pr_table(y, "pitcher", gk)),
    ("batted_ball_batter", lambda y, gk: cpbl_api.batted_ball(y, "batter", gk)),
    ("batted_ball_pitcher", lambda y, gk: cpbl_api.batted_ball(y, "pitcher", gk)),
    ("exit_velocity_batter", lambda y, gk: cpbl_api.exit_velocity(y, "batter", gk)),
    ("exit_velocity_pitcher", lambda y, gk: cpbl_api.exit_velocity(y, "pitcher", gk)),
    ("pitch_tracking", lambda y, gk: cpbl_api.pitch_tracking(y, gk)),
]

GAME_KINDS = ["A", "D"]  # 一軍, 二軍 (the only two that return rows)


def _flatten_row(row: dict) -> dict:
    """Hoist Player/Team into flat columns; lowercase keys."""
    out = {}
    player = row.pop("Player", None) or row.pop("player", None) or {}
    team = row.pop("Team", None) or row.pop("team", None) or {}
    if isinstance(player, dict):
        out["player_id"] = player.get("Acnt") or player.get("acnt")
        out["player_name"] = player.get("Name") or player.get("name")
    if isinstance(team, dict):
        out["team_code"] = team.get("Code") or team.get("code")
        out["team_name"] = team.get("Name") or team.get("name")
    for k, v in row.items():
        # PascalCase to snake_case
        key = _snake(k)
        if isinstance(v, (dict, list)):
            out[key] = json.dumps(v, ensure_ascii=False)
        else:
            out[key] = v
    return out


def _snake(s: str) -> str:
    out = []
    for i, c in enumerate(s):
        if c.isupper() and i > 0 and not s[i - 1].isupper():
            out.append("_")
        out.append(c.lower())
    return "".join(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", type=int, nargs="+", default=[2026])
    ap.add_argument("--delay", type=float, default=0.4)
    args = ap.parse_args()

    RANKINGS_DIR.mkdir(parents=True, exist_ok=True)
    CSV_DIR.mkdir(parents=True, exist_ok=True)
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)

    summary = []
    for name, fn in tqdm(ENDPOINTS, desc="endpoint"):
        all_rows = []
        for y in args.years:
            for gk in GAME_KINDS:
                try:
                    rows = fn(y, gk)
                except Exception as e:
                    print(f"[!] {name} y={y} gk={gk}: {e}")
                    continue
                tagged = [
                    {**_flatten_row(dict(r)), "year": y, "game_kind": gk}
                    for r in rows
                ]
                all_rows.extend(tagged)
                # cache raw
                raw_path = RANKINGS_DIR / f"{name}_{y}_{gk}.json"
                raw_path.write_text(
                    json.dumps(rows, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                time.sleep(args.delay)

        summary.append((name, len(all_rows)))
        if not all_rows:
            continue

        cols = sorted({k for r in all_rows for k in r.keys()})
        front = ["year", "game_kind", "player_id", "player_name",
                 "team_code", "team_name"]
        ordered = [c for c in front if c in cols] + [c for c in cols if c not in front]
        csv_path = CSV_DIR / f"rankings_{name}.csv"
        with csv_path.open("w", newline="", encoding="utf-8") as fp:
            w = csv.DictWriter(fp, fieldnames=ordered)
            w.writeheader()
            w.writerows(all_rows)

        # SQLite
        quoted = [f'"{c}"' for c in ordered]
        col_defs = ", ".join(f"{q} {_sqlite_type(c)}" for q, c in zip(quoted, ordered))
        table = f"rankings_{name}"
        cur = conn.cursor()
        cur.execute(f'DROP TABLE IF EXISTS "{table}"')
        cur.execute(f'CREATE TABLE "{table}" ({col_defs})')
        placeholders = ", ".join("?" for _ in ordered)
        cur.executemany(
            f'INSERT INTO "{table}" ({", ".join(quoted)}) VALUES ({placeholders})',
            [[r.get(c) for c in ordered] for r in all_rows],
        )
        conn.commit()

    conn.close()
    print("\nSummary:")
    for name, n in summary:
        print(f"  {name}: {n} rows")


def _sqlite_type(col: str) -> str:
    if col in {"year", "pa", "barrels", "bbe", "pitches"}:
        return "INTEGER"
    if col in {"player_id", "player_name", "team_code", "team_name",
               "game_kind", "throws", "pitch_type"}:
        return "TEXT"
    return "REAL"


if __name__ == "__main__":
    main()
