"""Crawl the full 2026 schedule and per-game detail (LiveLog, lineups).

Usage::

    # Whole season (default), one request per day; ~365 calls
    python scrape_schedule.py

    # Limited range
    python scrape_schedule.py --start 2026-03-01 --end 2026-05-14

    # Skip detail (only schedule list)
    python scrape_schedule.py --no-detail
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import gzip
import json
import sqlite3
import sys
import time
from pathlib import Path

from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import DATA_DIR
import api as cpbl_api

SCHED_DIR = DATA_DIR / "raw" / "schedule"
GAME_DIR = DATA_DIR / "raw" / "games"
CSV_DIR = DATA_DIR / "csv"
DB_PATH = DATA_DIR / "db" / "cpbl.sqlite"


def daterange(start: dt.date, end: dt.date):
    cur = start
    while cur <= end:
        yield cur
        cur += dt.timedelta(days=1)


def _flatten_game(g: dict, date_str: str) -> dict:
    visiting = g.get("Visiting") or {}
    home = g.get("Home") or {}
    vt = visiting.get("Team") or {}
    ht = home.get("Team") or {}
    field = g.get("Field") or {}
    wp = g.get("WinningPitcher") or {}
    lp = g.get("LoserPitcher") or {}
    cl = g.get("Closer") or {}
    return {
        "game_id": g.get("GameId"),
        "date": date_str,
        "game_status": g.get("GameStatus"),
        "kind_code": g.get("KindCode"),
        "game_sno": g.get("GameSno"),
        "week": g.get("Week"),
        "inning_seq": g.get("InningSeq"),
        "field_no": field.get("No"),
        "field_name": field.get("Abbe"),
        "pre_exe_date": g.get("PreExeDate"),
        "visiting_team_code": vt.get("Code"),
        "visiting_team_name": vt.get("Name"),
        "visiting_score": visiting.get("Score"),
        "visiting_record_w": (visiting.get("AccumulationScore") or {}).get("W"),
        "visiting_record_l": (visiting.get("AccumulationScore") or {}).get("L"),
        "visiting_record_t": (visiting.get("AccumulationScore") or {}).get("T"),
        "home_team_code": ht.get("Code"),
        "home_team_name": ht.get("Name"),
        "home_score": home.get("Score"),
        "home_record_w": (home.get("AccumulationScore") or {}).get("W"),
        "home_record_l": (home.get("AccumulationScore") or {}).get("L"),
        "home_record_t": (home.get("AccumulationScore") or {}).get("T"),
        "winning_pitcher_acnt": wp.get("Acnt"),
        "winning_pitcher_name": wp.get("Name"),
        "loser_pitcher_acnt": lp.get("Acnt"),
        "loser_pitcher_name": lp.get("Name"),
        "closer_acnt": cl.get("Acnt"),
        "closer_name": cl.get("Name"),
        "skip_trackman": g.get("SkipTrackman"),
        "visiting_home_type": g.get("VisitingHomeType"),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2026-03-01")
    ap.add_argument("--end", default="2026-11-30")
    ap.add_argument("--delay", type=float, default=0.25)
    ap.add_argument("--no-detail", action="store_true",
                    help="Skip per-game detail crawl")
    args = ap.parse_args()

    SCHED_DIR.mkdir(parents=True, exist_ok=True)
    GAME_DIR.mkdir(parents=True, exist_ok=True)
    CSV_DIR.mkdir(parents=True, exist_ok=True)
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    start = dt.date.fromisoformat(args.start)
    end = dt.date.fromisoformat(args.end)

    all_games: list[dict] = []
    for d in tqdm(list(daterange(start, end)), desc="schedule"):
        ds = d.isoformat()
        cache = SCHED_DIR / f"{ds}.json"
        if cache.exists():
            games = json.loads(cache.read_text(encoding="utf-8"))
        else:
            try:
                games = cpbl_api.schedule(ds)
            except Exception as e:
                print(f"[!] {ds}: {e}")
                continue
            cache.write_text(json.dumps(games, ensure_ascii=False, indent=2),
                             encoding="utf-8")
            time.sleep(args.delay)
        for g in games:
            all_games.append(_flatten_game(g, ds))

    print(f"Total games: {len(all_games)}")

    # Per-game detail
    if not args.no_detail:
        detail_summary = {"ok": 0, "skip": 0, "err": 0}
        for g in tqdm(all_games, desc="detail"):
            gid = g["game_id"]
            if not gid:
                detail_summary["skip"] += 1
                continue
            if g.get("game_status") in (None, "POSTPONED", "SCHEDULED"):
                # No data yet
                detail_summary["skip"] += 1
                continue
            out = GAME_DIR / f"{gid}.json.gz"
            if out.exists():
                detail_summary["ok"] += 1
                continue
            try:
                detail = cpbl_api.game(gid)
            except Exception as e:
                detail_summary["err"] += 1
                continue
            with gzip.open(out, "wt", encoding="utf-8") as fp:
                json.dump(detail, fp, ensure_ascii=False)
            detail_summary["ok"] += 1
            time.sleep(args.delay)
        print(f"detail: {detail_summary}")

    # CSV
    cols = list(all_games[0].keys()) if all_games else []
    csv_path = CSV_DIR / "schedule.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fp:
        w = csv.DictWriter(fp, fieldnames=cols)
        w.writeheader()
        w.writerows(all_games)
    print(f"CSV → {csv_path}")

    # SQLite
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    quoted = [f'"{c}"' for c in cols]
    col_defs = ", ".join(f"{q} {_sqlite_type(c)}" for q, c in zip(quoted, cols))
    cur.execute('DROP TABLE IF EXISTS "schedule"')
    cur.execute(f'CREATE TABLE "schedule" ({col_defs}, PRIMARY KEY ("game_id"))')
    placeholders = ", ".join("?" for _ in cols)
    cur.executemany(
        f'INSERT OR REPLACE INTO "schedule" ({", ".join(quoted)}) VALUES ({placeholders})',
        [[g.get(c) for c in cols] for g in all_games],
    )
    conn.commit()
    conn.close()
    print(f"SQLite schedule table ({len(all_games)} rows)")


def _sqlite_type(col: str) -> str:
    if col.endswith("_score") or col.endswith("_w") or col.endswith("_l") \
            or col.endswith("_t") or col in {"game_sno", "week", "inning_seq",
                                              "visiting_home_type"}:
        return "INTEGER"
    if col == "skip_trackman":
        return "INTEGER"
    return "TEXT"


if __name__ == "__main__":
    main()
