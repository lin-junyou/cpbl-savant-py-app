"""Batted-ball spray charts (擊球落點圖) from Trackman data.

Trackman ``Hit.LandingFlat`` gives ``Bearing`` (方位角, degrees from home plate
toward second base; positive = right field, negative = left field) and
``Distance`` in meters. Combined with ``Hit.Launch`` (exit velo, launch angle)
this lets us paint per-stadium / per-batter spray charts.

Usage::

    # All batted balls at 樂天桃園
    python analysis/spray.py --field 樂天桃園

    # Spray chart for a single batter (across all stadiums)
    python analysis/spray.py --batter 0000006888

    # Compare two batters
    python analysis/spray.py --batter 0000006888 0000001318

    # By pitcher: where opponents hit balls against this pitcher
    python analysis/spray.py --pitcher 0000007062

    # Filter by hit outcome (HR / hits / outs)
    python analysis/spray.py --field 大巨蛋 --hits-only
"""
from __future__ import annotations

import argparse
import sqlite3
import time
from pathlib import Path

import numpy as np
import pandas as pd

DB = Path(__file__).resolve().parent.parent / "data" / "db" / "cpbl.sqlite"
OUT_DIR = Path(__file__).resolve().parent / "out"

# Approximate CPBL park dimensions (meters along foul lines / center)
# Source: CPBL official + ballpark reference. Used only as visual guides.
STADIUMS = {
    "樂天桃園": {"L": 100, "C": 122, "R": 100},
    "洲際":     {"L": 99,  "C": 122, "R": 99},
    "新莊":     {"L": 99,  "C": 122, "R": 99},
    "天母":     {"L": 99,  "C": 121, "R": 99},
    "斗六":     {"L": 100, "C": 122, "R": 100},
    "澄清湖":   {"L": 99,  "C": 122, "R": 99},
    "大巨蛋":   {"L": 100, "C": 122, "R": 100},
    "青埔":     {"L": 95,  "C": 120, "R": 95},
    "園區":     {"L": 99,  "C": 122, "R": 99},
}


def _setup_font():
    try:
        from matplotlib import font_manager
        import matplotlib.pyplot as plt
        for path in ["/System/Library/Fonts/STHeiti Light.ttc",
                     "/System/Library/Fonts/PingFang.ttc",
                     "/Library/Fonts/Arial Unicode.ttf"]:
            if Path(path).exists():
                font_manager.fontManager.addfont(path)
                plt.rcParams["font.family"] = font_manager.FontProperties(
                    fname=path).get_name()
                return
    except ImportError:
        pass


def load(where_sql: str = "", params: tuple = ()) -> pd.DataFrame:
    conn = sqlite3.connect(DB)
    sql = (
        "SELECT field_name, hitter_name, hitter_acnt, pitcher_name, "
        "pitcher_acnt, content, batting_action, "
        "hit_exit_speed_kph, hit_launch_angle, hit_direction, "
        "land_bearing, land_distance_m, land_hang_time, auto_pitch_type "
        "FROM trackman_pitches "
        "WHERE land_distance_m IS NOT NULL"
    )
    if where_sql:
        sql += " AND " + where_sql
    df = pd.read_sql(sql, conn, params=params)
    conn.close()
    return df


def _outcome(content: str | None) -> str:
    if not content:
        return "其他"
    # Hits
    if "全壘打" in content:
        return "HR"
    if "三壘安打" in content:
        return "3B"
    if "二壘安打" in content:
        return "2B"
    if "一安" in content or "一壘安打" in content or ("安打" in content and "犧牲" not in content):
        return "1B"
    if "雙殺" in content:
        return "雙殺"
    if "犧牲" in content:
        return "犧牲"
    if "刺殺" in content or "接殺" in content or "出局" in content or "失誤" in content:
        return "出局/失誤"
    return "其他"


_COLOR = {
    "HR": "#d62728", "3B": "#9467bd", "2B": "#1f77b4", "1B": "#2ca02c",
    "雙殺": "#7f7f7f", "犧牲": "#bcbd22", "出局/失誤": "#cccccc",
    "其他": "#888888",
}


def spray_xy(bearing_deg: pd.Series, distance_m: pd.Series) -> tuple[np.ndarray, np.ndarray]:
    """Convert (bearing °, distance m) → (x, y) in meters.

    bearing 0° = straight to centre field (positive y).
    Positive bearing = right field (+x), negative = left field (-x).
    """
    rad = np.deg2rad(bearing_deg.to_numpy(dtype=float))
    d = distance_m.to_numpy(dtype=float)
    x = d * np.sin(rad)
    y = d * np.cos(rad)
    return x, y


def draw_field(ax, dims: dict | None = None) -> None:
    """Sketch a generic baseball field outline. ``dims`` may scale fence."""
    L = (dims or {}).get("L", 99)
    C = (dims or {}).get("C", 122)
    R = (dims or {}).get("R", 99)
    # Foul lines
    ax.plot([0, -L * np.sin(np.deg2rad(45))], [0, L * np.cos(np.deg2rad(45))],
            color="black", linewidth=1)
    ax.plot([0, R * np.sin(np.deg2rad(45))], [0, R * np.cos(np.deg2rad(45))],
            color="black", linewidth=1)
    # Outfield fence (parametric curve)
    angles = np.linspace(-45, 45, 60)
    rads = np.deg2rad(angles)
    # Smooth interpolation: dims at -45 / 0 / +45
    weights = np.cos(rads * 2)  # peaks at 0 for centre
    radii = np.where(angles == 0, C, np.where(angles < 0, L, R))
    radii = (1 - weights * 0) * radii  # keep simple; use centre for middle band
    # Better: piecewise
    radii_smooth = []
    for a in angles:
        if a < 0:
            t = (a + 45) / 45
            r = L * (1 - t) + C * t
        else:
            t = a / 45
            r = C * (1 - t) + R * t
        radii_smooth.append(r)
    radii_smooth = np.array(radii_smooth)
    ax.plot(radii_smooth * np.sin(rads), radii_smooth * np.cos(rads),
            color="darkgreen", linewidth=1.5)
    # Infield diamond (90 ft = 27.4 m)
    base = 27.4
    diamond = np.array([
        [0, 0], [base / np.sqrt(2), base / np.sqrt(2)],
        [0, base * np.sqrt(2)], [-base / np.sqrt(2), base / np.sqrt(2)],
        [0, 0],
    ])
    ax.plot(diamond[:, 0], diamond[:, 1], color="brown", linewidth=1)
    # Pitcher's mound (18.4 m)
    ax.plot([0], [18.4], "o", color="brown", markersize=4)
    ax.set_aspect("equal")
    ax.set_xlim(-130, 130)
    ax.set_ylim(-15, 145)
    ax.grid(True, alpha=0.2)


def plot_spray(df: pd.DataFrame, title: str, dims: dict | None = None,
               hits_only: bool = False) -> Path:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    _setup_font()

    df = df.copy()
    df["outcome"] = df["content"].map(_outcome)
    if hits_only:
        df = df[df["outcome"].isin({"HR", "3B", "2B", "1B"})]

    fig, ax = plt.subplots(figsize=(9, 8))
    draw_field(ax, dims=dims)

    x, y = spray_xy(df["land_bearing"], df["land_distance_m"])
    sizes = (df["hit_exit_speed_kph"].fillna(120).clip(80, 180) - 80) * 1.2
    colors = df["outcome"].map(_COLOR).fillna("#888888")
    ax.scatter(x, y, s=sizes, c=colors, alpha=0.6, edgecolors="black",
               linewidth=0.3)

    # Legend
    counts = df["outcome"].value_counts()
    handles = []
    for label in ["HR", "3B", "2B", "1B", "雙殺", "犧牲", "出局/失誤", "其他"]:
        if label in counts.index:
            handles.append(plt.Line2D([], [], marker="o", linestyle="",
                                       color=_COLOR[label],
                                       label=f"{label} ({counts[label]})"))
    ax.legend(handles=handles, loc="upper left", fontsize=9, framealpha=0.85)

    ax.set_title(title, fontsize=13)
    ax.set_xlabel("← 左外野    距離 (m)    右外野 →")
    ax.set_ylabel("距離 (m)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"spray_{int(time.time())}.png"
    fig.savefig(out, dpi=120, bbox_inches="tight")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--field", help="球場名稱（樂天桃園, 洲際, 新莊...）")
    ap.add_argument("--batter", nargs="+", help="一個或多個打者 ID")
    ap.add_argument("--pitcher", nargs="+", help="一個或多個投手 ID（看對手打到哪）")
    ap.add_argument("--hits-only", action="store_true",
                    help="只顯示安打（含全壘打）")
    ap.add_argument("--summary", action="store_true",
                    help="只顯示統計摘要（不出圖）")
    args = ap.parse_args()

    where, params = [], []
    title_bits = []
    if args.field:
        where.append("field_name = ?")
        params.append(args.field)
        title_bits.append(f"球場: {args.field}")
    if args.batter:
        ph = ",".join("?" * len(args.batter))
        where.append(f"hitter_acnt IN ({ph})")
        params.extend(args.batter)
        title_bits.append(f"打者: {','.join(args.batter)}")
    if args.pitcher:
        ph = ",".join("?" * len(args.pitcher))
        where.append(f"pitcher_acnt IN ({ph})")
        params.extend(args.pitcher)
        title_bits.append(f"投手: {','.join(args.pitcher)}")

    df = load(" AND ".join(where), tuple(params))
    if df.empty:
        print("(no batted balls match those filters — note 二軍 球場 has no Trackman)")
        return

    df["outcome"] = df["content"].map(_outcome)
    if args.hits_only:
        df = df[df["outcome"].isin({"HR", "3B", "2B", "1B"})]

    print(f"\n{len(df)} batted balls match.")
    print("\n--- Outcome breakdown ---")
    print(df["outcome"].value_counts().to_string())
    print(f"\nAvg exit speed: {df['hit_exit_speed_kph'].mean():.1f} kph")
    print(f"Avg launch angle: {df['hit_launch_angle'].mean():.1f}°")
    print(f"Avg landing distance: {df['land_distance_m'].mean():.1f} m "
          f"(max {df['land_distance_m'].max():.1f})")

    if args.batter and not args.field:
        # Replace IDs with name
        names = ", ".join(df["hitter_name"].dropna().unique()[:3])
        title_bits = [f"打者: {names}"] + [b for b in title_bits if not b.startswith("打者")]
    if args.pitcher and not args.field:
        names = ", ".join(df["pitcher_name"].dropna().unique()[:3])
        title_bits = [f"投手對戰: {names}"] + [b for b in title_bits if not b.startswith("投手")]

    if args.summary:
        return

    title = "擊球落點圖 — " + " | ".join(title_bits) if title_bits else "擊球落點圖"
    if args.hits_only:
        title += "（僅安打）"

    dims = STADIUMS.get(args.field) if args.field else None
    out = plot_spray(df, title, dims=dims, hits_only=args.hits_only)
    print(f"\n→ {out}")


if __name__ == "__main__":
    main()
