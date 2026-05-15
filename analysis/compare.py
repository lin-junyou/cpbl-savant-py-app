"""CPBL Player Comparison CLI.

Usage examples::

    # Compare a few pitchers by ID
    python analysis/compare.py 0000000128 0000005604

    # Compare by name (fuzzy substring on Chinese name)
    python analysis/compare.py --name 朱承洋 勝騎士

    # Top-N pitchers by wOBA percentile (allowed against)
    python analysis/compare.py --top 10 --role pitcher --metric woba_pr --asc

Outputs a side-by-side ASCII table and saves a radar-style PNG plot
(if matplotlib is installed) to ``analysis/out/compare_<ts>.png``.
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
import time
from pathlib import Path

import pandas as pd

DB = Path(__file__).resolve().parent.parent / "data" / "db" / "cpbl.sqlite"
OUT_DIR = Path(__file__).resolve().parent / "out"


COMPARE_METRICS = [
    ("pa", "PA", False),
    ("woba", "wOBA", False),
    ("ba", "BA", False),
    ("obp", "OBP", False),
    ("slg", "SLG", False),
    ("iso", "ISO", False),
    ("k_pct", "K%", True),
    ("bb_pct", "BB%", False),
    ("whiff_pct", "Whiff%", True),
    ("chase_pct", "Chase%", True),
    ("hard_hit_pct", "HardHit%", False),
    ("barrel_pct", "Barrel%", False),
    ("exit_velo_avg", "EV avg", False),
    ("exit_velo_max", "EV max", False),
]

PR_METRICS = [m[0] + "_pr" for m in COMPARE_METRICS if m[0] != "pa"]


def load_players() -> pd.DataFrame:
    conn = sqlite3.connect(DB)
    bio = pd.read_sql("SELECT * FROM players", conn)
    season = pd.read_sql("SELECT * FROM player_season", conn)
    pitch = pd.read_sql("SELECT * FROM pitch_tracking", conn)
    conn.close()
    df = bio.merge(season.drop(columns=["player_name", "team_code", "team_name"],
                                errors="ignore"),
                   on="player_id", how="left")
    pitch_agg = (pitch.groupby("player_id")
                 .agg(pitch_types=("pitch_type", lambda s: ",".join(sorted(set(s)))),
                      max_kph=("kph_max", "max"),
                      max_spin=("spin_rpm_max", "max"))
                 .reset_index())
    df = df.merge(pitch_agg, on="player_id", how="left")
    return df


def resolve_ids(df: pd.DataFrame, ids_or_names: list[str]) -> pd.DataFrame:
    rows = []
    for tok in ids_or_names:
        if tok.isdigit() and len(tok) == 10:
            sub = df[df["player_id"] == tok]
        else:
            sub = df[df["name"].str.contains(tok, na=False)
                     | df["name_en"].str.contains(tok, na=False, case=False)]
        if sub.empty:
            print(f"[!] no match for {tok!r}")
            continue
        if len(sub) > 1:
            print(f"[!] {tok!r} matched {len(sub)} players, using first ({sub.iloc[0]['name']})")
        rows.append(sub.iloc[0])
    if not rows:
        sys.exit(1)
    return pd.DataFrame(rows)


def print_table(players: pd.DataFrame) -> None:
    header = ["Metric"] + [f'{p["name"]}' for _, p in players.iterrows()]
    rows = [header]
    bio_keys = [("team_name", "Team"), ("position_name", "Pos"),
                ("jersey_number", "#"), ("batting_hand", "B"),
                ("throwing_hand", "T"), ("height_cm", "Ht(cm)"),
                ("weight_kg", "Wt(kg)"), ("school", "School")]
    for key, label in bio_keys:
        rows.append([label] + [str(p.get(key, "")) for _, p in players.iterrows()])
    rows.append(["—" * 8] + ["—" * 10] * len(players))
    for key, label, _ in COMPARE_METRICS:
        cells = []
        for _, p in players.iterrows():
            v = p.get(key)
            pr = p.get(f"{key}_pr")
            if v is None or pd.isna(v):
                cells.append("—")
            else:
                cell = f"{v:.3f}" if isinstance(v, float) and abs(v) < 5 else f"{v:.1f}" if isinstance(v, float) else str(v)
                if pr is not None and not pd.isna(pr):
                    cell += f" (PR{int(pr)})"
                cells.append(cell)
        rows.append([label] + cells)
    # Render
    widths = [max(len(str(r[i])) for r in rows) for i in range(len(rows[0]))]
    for r in rows:
        print("  ".join(str(r[i]).ljust(widths[i]) for i in range(len(r))))


def save_radar(players: pd.DataFrame) -> Path | None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib import font_manager
        import numpy as np
    except ImportError:
        return None

    for path in ["/System/Library/Fonts/STHeiti Light.ttc",
                 "/System/Library/Fonts/STHeiti Medium.ttc",
                 "/Library/Fonts/Arial Unicode.ttf",
                 "/System/Library/Fonts/PingFang.ttc"]:
        if Path(path).exists():
            font_manager.fontManager.addfont(path)
            plt.rcParams["font.family"] = font_manager.FontProperties(fname=path).get_name()
            break

    metric_keys = [m for m in PR_METRICS if any(m in p.index for _, p in players.iterrows())]
    labels = [m.replace("_pr", "").upper() for m in metric_keys]
    angles = np.linspace(0, 2 * np.pi, len(labels), endpoint=False).tolist() + [0]

    fig, ax = plt.subplots(figsize=(9, 9), subplot_kw=dict(polar=True))
    for _, p in players.iterrows():
        vals = []
        for m in metric_keys:
            v = p.get(m)
            vals.append(0 if v is None or pd.isna(v) else float(v))
        vals += [vals[0]]
        ax.plot(angles, vals, label=p["name"], linewidth=2)
        ax.fill(angles, vals, alpha=0.15)
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels, fontsize=10)
    ax.set_ylim(0, 100)
    ax.set_yticks([25, 50, 75])
    ax.set_yticklabels(["25", "50", "75"])
    ax.legend(loc="upper right", bbox_to_anchor=(1.25, 1.0))
    ax.set_title("CPBL 進階數據百分位 PR 雷達圖", pad=20, fontsize=14)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"compare_{int(time.time())}.png"
    fig.savefig(path, dpi=120, bbox_inches="tight")
    return path


def cmd_top(df: pd.DataFrame, args: argparse.Namespace) -> None:
    sub = df.copy()
    if args.role == "pitcher":
        sub = sub[sub["position_code"] == "1"]
    elif args.role == "batter":
        sub = sub[sub["position_code"] != "1"]
    if args.minpa:
        sub = sub[sub["pa"].fillna(0) >= args.minpa]
    if args.division == "first":
        sub = sub[~sub["team_name"].str.contains("二軍", na=False)]
    elif args.division == "second":
        sub = sub[sub["team_name"].str.contains("二軍", na=False)]
    sub = sub.dropna(subset=[args.metric])
    sub = sub.sort_values(args.metric, ascending=args.asc).head(args.top)
    print(f"\nTop {args.top} {args.role or 'all'} by {args.metric} "
          f"({'asc' if args.asc else 'desc'}, min PA={args.minpa or 0}, "
          f"division={args.division or 'all'}):\n")
    cols = ["player_id", "name", "team_name", "position_name", "pa"]
    metric_base = args.metric.replace("_pr", "")
    for c in [metric_base, args.metric]:
        if c in sub.columns and c not in cols:
            cols.append(c)
    print(sub[cols].to_string(index=False))


def main() -> None:
    ap = argparse.ArgumentParser(formatter_class=argparse.RawDescriptionHelpFormatter,
                                 description=__doc__)
    ap.add_argument("ids", nargs="*", help="Player IDs or names")
    ap.add_argument("--name", nargs="+", help="Alias of positional ids (names ok)")
    ap.add_argument("--top", type=int, help="Show top-N instead of compare")
    ap.add_argument("--role", choices=["pitcher", "batter"], default=None)
    ap.add_argument("--metric", default="woba_pr",
                    help="Metric to sort by (default woba_pr)")
    ap.add_argument("--asc", action="store_true", help="Sort ascending")
    ap.add_argument("--minpa", type=int, default=0,
                    help="Minimum plate appearances (default 0)")
    ap.add_argument("--division", choices=["first", "second"],
                    default=None, help="Filter 一軍 (first) or 二軍 (second)")
    ap.add_argument("--no-plot", action="store_true")
    args = ap.parse_args()

    df = load_players()
    if args.top:
        cmd_top(df, args)
        return

    tokens = list(args.ids) + (args.name or [])
    if not tokens:
        ap.print_help()
        return
    players = resolve_ids(df, tokens)
    print_table(players)
    if not args.no_plot:
        path = save_radar(players)
        if path:
            print(f"\n雷達圖 → {path}")


if __name__ == "__main__":
    main()
