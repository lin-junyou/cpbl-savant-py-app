"""Expand per-game pitching/hitting lines into flat SQLite tables.

Reads ``data/raw/games/*.json.gz`` (the cached game-detail responses) and
produces three SQLite tables:

* ``game_hitters``  — one row per (game, hitter)
* ``game_pitchers`` — one row per (game, pitcher)
* ``inning_scores`` — one row per (game, side, inning) for run scoring

CSV mirrors are also written to ``data/csv/``.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import sqlite3
import sys
from pathlib import Path

from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import DATA_DIR

GAME_DIR = DATA_DIR / "raw" / "games"
CSV_DIR = DATA_DIR / "csv"
DB_PATH = DATA_DIR / "db" / "cpbl.sqlite"


def _snake(s: str) -> str:
    out = []
    for i, c in enumerate(s):
        if c.isupper() and i > 0 and not s[i - 1].isupper():
            out.append("_")
        out.append(c.lower())
    return "".join(out)


def _flatten(rec: dict) -> dict:
    return {_snake(k): v for k, v in rec.items()}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if not GAME_DIR.exists():
        sys.exit("no cached games — run scraper/scrape_schedule.py first")

    files = sorted(GAME_DIR.glob("*.json.gz"))
    if args.limit:
        files = files[: args.limit]
    print(f"games: {len(files)}")

    hitter_rows: list[dict] = []
    pitcher_rows: list[dict] = []
    inning_rows: list[dict] = []

    for f in tqdm(files, desc="games"):
        with gzip.open(f, "rt", encoding="utf-8") as fp:
            g = json.load(fp)
        gid = g.get("GameId")
        pre_exe = (g.get("PreExeDate") or "").split("T", 1)[0]
        kind = g.get("KindCode")
        sno = g.get("GameSno")

        for side in ("Visiting", "Home"):
            sd = g.get(side) or {}
            team = (sd.get("Team") or {}).get("Name")
            team_code = (sd.get("Team") or {}).get("Code")
            for h in sd.get("Hitters") or []:
                row = _flatten(h)
                row.update(
                    {"game_id": gid, "date": pre_exe, "kind_code": kind,
                     "game_sno": sno, "side": side, "team_name": team,
                     "team_code": team_code}
                )
                hitter_rows.append(row)
            for p in sd.get("Pitchers") or []:
                row = _flatten(p)
                row.update(
                    {"game_id": gid, "date": pre_exe, "kind_code": kind,
                     "game_sno": sno, "side": side, "team_name": team,
                     "team_code": team_code}
                )
                pitcher_rows.append(row)
            for inn in sd.get("InningScore") or []:
                # ``Score`` can be "X" when the half-inning was not played
                # (home team leading entering bottom of the last inning).
                raw_score = inn.get("Score")
                try:
                    runs = int(raw_score) if raw_score not in (None, "", "X") else None
                except (TypeError, ValueError):
                    runs = None
                inning_rows.append({
                    "game_id": gid, "date": pre_exe, "kind_code": kind,
                    "side": side, "team_name": team, "team_code": team_code,
                    "inning": inn.get("Seq"),
                    "runs": runs,
                    "raw_score": raw_score,
                })

    print(f"hitter rows: {len(hitter_rows)}  pitcher rows: {len(pitcher_rows)}  "
          f"innings: {len(inning_rows)}")

    _write(hitter_rows, "game_hitters", CSV_DIR / "game_hitters.csv",
           front=["game_id", "date", "kind_code", "side", "team_name",
                  "hitter_acnt", "hitter_name", "lineup", "defend_station",
                  "plate_appearances", "hitting_cnt", "hit_cnt",
                  "one_base_hit_cnt", "two_base_hit_cnt", "three_base_hit_cnt",
                  "home_run_cnt", "run_batted_in_cnt", "strike_out_cnt",
                  "bases_on_balls_cnt", "score_cnt", "avg"])
    _write(pitcher_rows, "game_pitchers", CSV_DIR / "game_pitchers.csv",
           front=["game_id", "date", "kind_code", "side", "team_name",
                  "pitcher_acnt", "pitcher_name", "role_type",
                  "inning_pitched_cnt", "inning_pitched_div3_cnt",
                  "plate_appearances", "hitting_cnt", "home_run_cnt",
                  "strike_out_cnt", "bases_on_balls_cnt",
                  "earned_run_cnt", "run_cnt", "era", "whip", "pitch_cnt",
                  "strike_cnt"])
    _write(inning_rows, "inning_scores", CSV_DIR / "inning_scores.csv",
           front=["game_id", "date", "kind_code", "side", "team_name",
                  "inning", "runs"])


def _write(rows: list[dict], table: str, csv_path: Path, front: list[str]) -> None:
    if not rows:
        return
    cols = sorted({k for r in rows for k in r.keys()})
    ordered = [c for c in front if c in cols] + [c for c in cols if c not in front]
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8") as fp:
        w = csv.DictWriter(fp, fieldnames=ordered)
        w.writeheader()
        w.writerows(rows)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    quoted = [f'"{c}"' for c in ordered]
    col_defs = ", ".join(f"{q} {_type(c)}" for q, c in zip(quoted, ordered))
    cur = conn.cursor()
    cur.execute(f'DROP TABLE IF EXISTS "{table}"')
    cur.execute(f'CREATE TABLE "{table}" ({col_defs})')
    placeholders = ", ".join("?" for _ in ordered)
    cur.executemany(
        f'INSERT INTO "{table}" ({", ".join(quoted)}) VALUES ({placeholders})',
        [[r.get(c) for c in ordered] for r in rows],
    )
    conn.commit()
    conn.close()
    print(f"  → {table} ({len(rows)} rows) + {csv_path.name}")


def _type(col: str) -> str:
    if col.endswith("_cnt") or col in {"game_sno", "lineup", "inning", "runs",
                                       "score_cnt", "plate_appearances",
                                       "pitch_cnt", "strike_cnt", "rboe",
                                       "is_save_ok", "is_save_fail",
                                       "is_current"}:
        return "INTEGER"
    if col in {"era", "whip", "avg"}:
        return "REAL"
    return "TEXT"


if __name__ == "__main__":
    main()
