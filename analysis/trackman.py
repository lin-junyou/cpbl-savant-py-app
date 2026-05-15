"""Pitch-level Trackman analysis from cached game LiveLogs.

Examples::

    # Pitch repertoire summary for a pitcher
    python analysis/trackman.py 0000007062

    # Pitch repertoire + strike-zone heatmap PNG
    python analysis/trackman.py 0000007062 --plot

    # Compare two pitchers' repertoires
    python analysis/trackman.py 0000007062 0000005151

    # By batter (which pitches did they see / how did they fare)
    python analysis/trackman.py --batter 0000000929
"""
from __future__ import annotations

import argparse
import gzip
import json
import sqlite3
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
GAME_DIR = DATA_DIR / "raw" / "games"
DB = DATA_DIR / "db" / "cpbl.sqlite"
OUT_DIR = Path(__file__).resolve().parent / "out"


def load_pitches() -> pd.DataFrame:
    """Flatten LiveLog Trackman data across all cached games into a DataFrame.

    Caches result to ``data/db/cpbl.sqlite`` table ``trackman_pitches``.
    """
    if DB.exists():
        conn = sqlite3.connect(DB)
        try:
            df = pd.read_sql("SELECT * FROM trackman_pitches", conn)
            conn.close()
            return df
        except Exception:
            conn.close()

    rows: list[dict] = []
    for f in sorted(GAME_DIR.glob("*.json.gz")):
        with gzip.open(f, "rt", encoding="utf-8") as fp:
            g = json.load(fp)
        gid = g.get("GameId")
        date = (g.get("PreExeDate") or "").split("T", 1)[0]
        field = g.get("Field") or {}
        field_no = field.get("No")
        field_name = field.get("Abbe")
        for p in g.get("LiveLog") or []:
            tm = p.get("Trackman") or {}
            play_tag = (tm.get("Play") or {}).get("PitchTag") or {}
            pitch_pos = (tm.get("Pitch") or {})
            release = pitch_pos.get("Release") or {}
            location = pitch_pos.get("Location") or {}
            flight = (pitch_pos.get("Flight") or {}).get("PolyFit", {}) \
                .get("PitchTrajectory") or {}
            hit = tm.get("Hit") or {}
            launch = hit.get("Launch") or {}
            landing = hit.get("LandingFlat") or {}
            contact = launch.get("ContactPosition") or {}
            row = {
                "game_id": gid, "date": date,
                "field_no": field_no, "field_name": field_name,
                "inning": p.get("InningSeq"),
                "out_cnt": p.get("OutCnt"),
                "ball_cnt": p.get("BallCnt"),
                "strike_cnt": p.get("StrikeCnt"),
                "pitch_cnt": p.get("PitchCnt"),
                "pitcher_acnt": p.get("PitcherAcnt"),
                "pitcher_name": p.get("PitcherName"),
                "hitter_acnt": p.get("HitterAcnt"),
                "hitter_name": p.get("HitterName"),
                "batting_action": p.get("BattingActionName"),
                "is_ball": int(p.get("IsBall") or 0),
                "is_strike": int(p.get("IsStrike") or 0),
                "is_score": int(p.get("IsScoreCnt") or 0),
                "content": p.get("Content"),
                # Trackman tags
                "pitch_call": play_tag.get("PitchCall"),
                "auto_pitch_type": play_tag.get("AutoPitchType"),
                "tagged_pitch_type": play_tag.get("TaggedPitchType"),
                # Release
                "rel_speed_kph": release.get("RelSpeed"),
                "spin_rate": release.get("SpinRate"),
                "extension": release.get("Extension"),
                "rel_height": release.get("RelHeight"),
                "rel_side": release.get("RelSide"),
                # Plate-crossing location
                "plate_loc_side": location.get("PlateLocSide"),
                "plate_loc_height": location.get("PlateLocHeight"),
                "zone_speed_kph": location.get("ZoneSpeed"),
                "horz_appr_angle": location.get("HorzApprAngle"),
                "vert_appr_angle": location.get("VertApprAngle"),
                # PolyFit trajectory coefficients (3 quadratics over time)
                "traj_x": json.dumps(flight.get("X")) if flight.get("X") else None,
                "traj_y": json.dumps(flight.get("Y")) if flight.get("Y") else None,
                "traj_z": json.dumps(flight.get("Z")) if flight.get("Z") else None,
                # Hit / batted ball
                "hit_exit_speed_kph": launch.get("ExitSpeed"),
                "hit_launch_angle": launch.get("Angle"),
                "hit_direction": launch.get("Direction"),
                "hit_spin_rate": launch.get("HitSpinRate"),
                "contact_x": contact.get("X"),
                "contact_y": contact.get("Y"),
                "contact_z": contact.get("Z"),
                "land_bearing": landing.get("Bearing"),
                "land_distance_m": landing.get("Distance"),
                "land_hang_time": landing.get("HangTime"),
            }
            rows.append(row)

    df = pd.DataFrame(rows)
    print(f"flattened {len(df)} pitches; caching to SQLite ...")
    DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB)
    df.to_sql("trackman_pitches", conn, if_exists="replace", index=False)
    conn.commit()
    conn.close()
    return df


def repertoire(df: pd.DataFrame, pitcher_id: str) -> pd.DataFrame:
    """Aggregate pitch counts and avg metrics by pitch type for one pitcher."""
    sub = df[df["pitcher_acnt"] == pitcher_id].copy()
    if sub.empty:
        return sub
    grp = sub.groupby("auto_pitch_type", dropna=False).agg(
        pitches=("pitch_call", "size"),
        usage_pct=("pitch_call", lambda s: 100 * len(s) / len(sub)),
        avg_kph=("rel_speed_kph", "mean"),
        max_kph=("rel_speed_kph", "max"),
        avg_spin=("spin_rate", "mean"),
        max_spin=("spin_rate", "max"),
        avg_extension=("extension", "mean"),
        avg_rel_height=("rel_height", "mean"),
        whiffs=("pitch_call", lambda s: (s == "StrikeSwinging").sum()),
        called_strikes=("pitch_call", lambda s: (s == "StrikeCalled").sum()),
        balls=("pitch_call", lambda s: (s == "BallCalled").sum()),
        in_play=("pitch_call", lambda s: s.isin(["InPlay", "InPlayHit", "InPlayOut"]).sum()),
    ).round(1).sort_values("pitches", ascending=False)
    return grp


def heatmap(df: pd.DataFrame, pitcher_id: str, name: str | None = None) -> Path | None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib import font_manager
    except ImportError:
        print("matplotlib not installed; skipping plot")
        return None

    for path in ["/System/Library/Fonts/STHeiti Light.ttc",
                 "/System/Library/Fonts/PingFang.ttc",
                 "/Library/Fonts/Arial Unicode.ttf"]:
        if Path(path).exists():
            font_manager.fontManager.addfont(path)
            plt.rcParams["font.family"] = font_manager.FontProperties(fname=path).get_name()
            break

    sub = df[df["pitcher_acnt"] == pitcher_id].dropna(subset=["plate_loc_side", "plate_loc_height"])
    if sub.empty:
        print("no Trackman location data")
        return None

    # group up to 4 most-thrown pitch types
    types = (sub["auto_pitch_type"].value_counts().head(4).index.tolist())
    fig, axes = plt.subplots(1, len(types), figsize=(4 * len(types), 4.5),
                             sharex=True, sharey=True)
    if len(types) == 1:
        axes = [axes]

    pname = name or sub.iloc[0]["pitcher_name"] or pitcher_id
    fig.suptitle(f"{pname} 球路位置熱圖（捕手視角）", fontsize=14)

    # CPBL strike zone (approximate, in feet → meters: standard 17"/2 = 0.215m)
    zone_x = 0.215  # half-plate width in m (TM units appear in m here)
    zone_top = 1.07
    zone_bot = 0.46

    for ax, pt in zip(axes, types):
        ps = sub[sub["auto_pitch_type"] == pt]
        ax.hexbin(ps["plate_loc_side"], ps["plate_loc_height"],
                  gridsize=18, cmap="Reds", mincnt=1, extent=(-0.8, 0.8, 0.0, 1.6))
        # strike zone box
        ax.plot([-zone_x, zone_x, zone_x, -zone_x, -zone_x],
                [zone_bot, zone_bot, zone_top, zone_top, zone_bot],
                color="black", linewidth=1.5)
        ax.set_xlim(-0.8, 0.8)
        ax.set_ylim(0.0, 1.7)
        ax.set_xlabel("側向 (m)")
        ax.set_aspect("equal")
        ax.set_title(f"{pt} (n={len(ps)})", fontsize=11)
    axes[0].set_ylabel("高度 (m)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"heatmap_{pitcher_id}_{int(time.time())}.png"
    fig.savefig(out, dpi=120, bbox_inches="tight")
    return out


def batter_view(df: pd.DataFrame, batter_id: str) -> pd.DataFrame:
    sub = df[df["hitter_acnt"] == batter_id].copy()
    if sub.empty:
        return sub
    grp = sub.groupby("auto_pitch_type", dropna=False).agg(
        seen=("pitch_call", "size"),
        avg_kph=("rel_speed_kph", "mean"),
        whiffs=("pitch_call", lambda s: (s == "StrikeSwinging").sum()),
        called_strikes=("pitch_call", lambda s: (s == "StrikeCalled").sum()),
        in_play=("pitch_call", lambda s: s.isin(["InPlay", "InPlayHit", "InPlayOut"]).sum()),
    )
    grp["whiff_rate_pct"] = (100 * grp["whiffs"] / grp["seen"]).round(1)
    return grp.round(1).sort_values("seen", ascending=False)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pitcher_ids", nargs="*",
                    help="One or more pitcher IDs (10 digits)")
    ap.add_argument("--batter", help="Batter ID to analyse instead")
    ap.add_argument("--plot", action="store_true", help="Save strike-zone PNG")
    ap.add_argument("--rebuild", action="store_true",
                    help="Rebuild trackman_pitches table from raw game files")
    args = ap.parse_args()

    if args.rebuild:
        # Drop and rebuild
        if DB.exists():
            conn = sqlite3.connect(DB)
            conn.execute("DROP TABLE IF EXISTS trackman_pitches")
            conn.commit()
            conn.close()

    df = load_pitches()
    print(f"\nloaded {len(df):,} pitches from {df['game_id'].nunique()} games\n")

    if args.batter:
        view = batter_view(df, args.batter)
        if view.empty:
            print(f"no pitches for batter {args.batter}")
            return
        print(f"=== Batter {args.batter} ({(view.iloc[0].name)}) — pitch-type breakdown ===\n")
        print(view.to_string())
        return

    if not args.pitcher_ids:
        ap.print_help()
        return

    for pid in args.pitcher_ids:
        rep = repertoire(df, pid)
        if rep.empty:
            print(f"\n[!] no pitches for {pid}")
            continue
        sub = df[df["pitcher_acnt"] == pid]
        name = sub["pitcher_name"].dropna().iloc[0] if not sub.empty else pid
        print(f"\n=== {name} ({pid}) — repertoire ===\n")
        print(rep.to_string())
        if args.plot:
            out = heatmap(df, pid, name=name)
            if out:
                print(f"  → {out}")


if __name__ == "__main__":
    main()
