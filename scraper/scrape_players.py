"""Crawl all CPBL players: listing + per-player detail."""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import sqlite3
import time
from pathlib import Path

from tqdm import tqdm

from common import BASE_URL, DATA_DIR, fetch
from parse_listing import parse_listing_html
from parse_player import parse_player_page

RAW_DIR = DATA_DIR / "raw" / "players"
LOG_DIR = DATA_DIR / "raw" / "player_logs"
CSV_DIR = DATA_DIR / "csv"
DB_PATH = DATA_DIR / "db" / "cpbl.sqlite"


def fetch_listing(force: bool = False) -> list[dict]:
    cache = DATA_DIR / "raw" / "players_index.html"
    if cache.exists() and not force:
        html = cache.read_text(encoding="utf-8")
    else:
        html = fetch(f"{BASE_URL}/players")
        cache.write_text(html, encoding="utf-8")
    return parse_listing_html(html)


def fetch_player_html(pid: str, force: bool = False) -> str:
    out = RAW_DIR / f"{pid}.html"
    if out.exists() and not force:
        return out.read_text(encoding="utf-8")
    html = fetch(f"{BASE_URL}/players/{pid}")
    out.write_text(html, encoding="utf-8")
    return html


def _sqlite_type(col: str) -> str:
    if col in {"height_cm", "weight_kg", "pa", "barrels"}:
        return "INTEGER"
    if (col.startswith("woba") or col.startswith("ba") or col.startswith("slg")
            or col.startswith("iso") or col.startswith("obp") or col.startswith("barrel")
            or col.startswith("exit_velo") or col.startswith("hard_hit")
            or col.startswith("k_pct") or col.startswith("bb_pct")
            or col.startswith("whiff_pct") or col.startswith("chase_pct")
            or "_pr" in col or col.endswith("_pct")):
        return "REAL"
    return "TEXT"


def _write_csv(path: Path, rows: list[dict], front_cols: list[str]) -> None:
    if not rows:
        return
    cols = sorted({k for r in rows for k in r.keys()})
    ordered = [c for c in front_cols if c in cols] + [c for c in cols if c not in front_cols]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fp:
        w = csv.DictWriter(fp, fieldnames=ordered)
        w.writeheader()
        w.writerows(rows)


def _write_table(conn: sqlite3.Connection, table: str, rows: list[dict],
                 front_cols: list[str], pk: list[str] | None = None) -> None:
    if not rows:
        return
    cols = sorted({k for r in rows for k in r.keys()})
    ordered = [c for c in front_cols if c in cols] + [c for c in cols if c not in front_cols]
    quoted = [f'"{c}"' for c in ordered]
    col_defs = ", ".join(f'{q} {_sqlite_type(c)}' for q, c in zip(quoted, ordered))
    pk_clause = f', PRIMARY KEY ({", ".join(f"\"{c}\"" for c in pk)})' if pk else ""
    cur = conn.cursor()
    cur.execute(f'DROP TABLE IF EXISTS "{table}"')
    cur.execute(f'CREATE TABLE "{table}" ({col_defs}{pk_clause})')
    placeholders = ", ".join("?" for _ in ordered)
    col_list = ", ".join(quoted)
    cur.executemany(
        f'INSERT OR REPLACE INTO "{table}" ({col_list}) VALUES ({placeholders})',
        [[row.get(c) for c in ordered] for row in rows],
    )
    conn.commit()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="Only crawl first N (debug)")
    ap.add_argument("--delay", type=float, default=0.8)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--skip-logs", action="store_true",
                    help="Don't save pitch-by-pitch logs (saves disk)")
    args = ap.parse_args()

    print("Fetching listing ...")
    roster = fetch_listing(force=args.force)
    print(f"  found {len(roster)} players")
    (DATA_DIR / "raw" / "players_index.json").write_text(
        json.dumps(roster, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    targets = roster if args.limit == 0 else roster[: args.limit]

    bio_rows: list[dict] = []
    season_rows: list[dict] = []
    pitch_rows: list[dict] = []
    pr_tables: dict[str, list[dict]] = {}  # keyed by meta signature
    errors: list[dict] = []

    for r in tqdm(targets, desc="players"):
        pid = r["player_id"]
        if not pid:
            continue
        try:
            html = fetch_player_html(pid, force=args.force)
            parsed = parse_player_page(pid, html)
        except Exception as e:
            errors.append({"player_id": pid, "error": str(e)})
            time.sleep(args.delay)
            continue

        bio = parsed["bio"]
        # Fall back to listing-derived fields when bio is missing data
        for k_b, k_l in [("name","name"),("name_en","name_en"),
                         ("team_name","team_name"),("position_code","position_code"),
                         ("position_name","position_name"),("jersey_number","jersey_number"),
                         ("image_url","image_url")]:
            if not bio.get(k_b) and r.get(k_l):
                bio[k_b] = r[k_l]
        bio["listing_team_code"] = r.get("team_code")
        bio_rows.append(bio)

        if parsed["season"]:
            row = dict(parsed["season"])
            row["meta"] = json.dumps(parsed["meta"], ensure_ascii=False)
            season_rows.append(row)

        for pt in parsed["pitch_types"]:
            pitch_rows.append(pt)

        if parsed["pr_table"]:
            meta = parsed["meta"] or {}
            sig = (
                f'{meta.get("year","?")}-{meta.get("searchType","?")}-'
                f'{meta.get("gameKind","?")}'
            )
            if sig not in pr_tables:
                pr_tables[sig] = [dict(row, _meta=json.dumps(meta, ensure_ascii=False))
                                  for row in parsed["pr_table"]]

        if parsed["logs"] and not args.skip_logs:
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            log_path = LOG_DIR / f"{pid}.json.gz"
            with gzip.open(log_path, "wt", encoding="utf-8") as fp:
                json.dump(parsed["logs"], fp, ensure_ascii=False)

        time.sleep(args.delay)

    print(f"bio rows: {len(bio_rows)}  season rows: {len(season_rows)}  pitch rows: {len(pitch_rows)}")
    print(f"pr_table groups: {list(pr_tables.keys())}")

    # CSV
    bio_front = [
        "player_id", "name", "name_en", "team_name", "team_code",
        "position_code", "position_name", "jersey_number", "batting_hand",
        "throwing_hand", "birthdate", "first_game_date", "height_cm",
        "weight_kg", "school", "is_foreign", "is_aboriginal",
    ]
    _write_csv(CSV_DIR / "players.csv", bio_rows, bio_front)

    season_front = ["player_id", "player_name", "team_name", "team_code", "pa", "woba", "woba_pr",
                    "ba", "ba_pr", "obp", "obp_pr", "slg", "slg_pr", "iso", "iso_pr"]
    _write_csv(CSV_DIR / "player_season.csv", season_rows, season_front)

    pitch_front = ["player_id", "player_name", "team_name", "team_code",
                   "throws", "pitch_type", "pitches", "kph_avg", "kph_max",
                   "spin_rpm_avg", "spin_rpm_max"]
    _write_csv(CSV_DIR / "pitch_tracking.csv", pitch_rows, pitch_front)

    for sig, rows in pr_tables.items():
        _write_csv(CSV_DIR / f"pr_table_{sig}.csv", rows, season_front + ["_meta"])

    # SQLite
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    _write_table(conn, "players", bio_rows, bio_front, pk=["player_id"])
    _write_table(conn, "player_season", season_rows, season_front)
    _write_table(conn, "pitch_tracking", pitch_rows, pitch_front)
    combined_pr = [dict(row, _pr_group=sig) for sig, rows in pr_tables.items() for row in rows]
    _write_table(conn, "season_pr_table", combined_pr, season_front + ["_pr_group", "_meta"])
    conn.close()
    print(f"SQLite → {DB_PATH}")

    if errors:
        (DATA_DIR / "raw" / "player_errors.json").write_text(
            json.dumps(errors, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"errors ({len(errors)}) recorded")


if __name__ == "__main__":
    main()
