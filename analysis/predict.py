"""Expected wOBA (xwOBA) + rest-of-season projection.

What this does (and what it doesn't):

* We only have one partial 2026 season — there is no multi-year data to train a
  classic year-over-year projection (e.g. ZiPS / Marcels). Instead we build a
  ridge regression that learns a player's wOBA from peripheral stats that
  stabilize quickly (exit velo, hard hit %, barrel %, BB%, K%, plate
  discipline). Treat the output as an *estimate of true talent*, not a
  prediction of the future.
* The "rest-of-season" column applies a Bayesian shrinkage: blend the
  player's actual wOBA with their xwOBA, weighted by their plate appearances
  vs a regression constant (default 100 PA — typical for hitters).

Usage::

    python analysis/predict.py
    python analysis/predict.py --top 20 --role batter --division first --minpa 50
    python analysis/predict.py --player 0000001318
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

# Features used to estimate xwOBA. All exist in `player_season`.
FEATURES = [
    "bb_pct", "k_pct", "whiff_pct", "chase_pct",
    "hard_hit_pct", "barrel_pct",
    "exit_velo_avg", "exit_velo_max",
]
TARGET = "woba"


def load() -> pd.DataFrame:
    conn = sqlite3.connect(DB)
    bio = pd.read_sql(
        "SELECT player_id, name, name_en, team_name, position_code, position_name "
        "FROM players", conn,
    )
    season = pd.read_sql("SELECT * FROM player_season", conn)
    conn.close()
    season = season.drop(columns=["player_name", "team_name", "team_code"],
                         errors="ignore")
    return bio.merge(season, on="player_id", how="inner")


def fit_xwoba(df: pd.DataFrame, min_pa: int = 30) -> tuple[dict, float]:
    """Ridge regression on peripherals → wOBA. Returns coefficients + RMSE."""
    train = df.dropna(subset=FEATURES + [TARGET])
    train = train[train["pa"] >= min_pa]
    if len(train) < 30:
        raise RuntimeError(f"not enough training rows ({len(train)})")

    X = train[FEATURES].to_numpy(dtype=float)
    y = train[TARGET].to_numpy(dtype=float)
    # Standardize
    mu, sd = X.mean(axis=0), X.std(axis=0).clip(min=1e-9)
    Xs = (X - mu) / sd

    # Ridge: (X'X + λI)^-1 X'y
    n, p = Xs.shape
    lam = 1.0
    A = Xs.T @ Xs + lam * np.eye(p)
    b = Xs.T @ (y - y.mean())
    w_std = np.linalg.solve(A, b)
    intercept = float(y.mean())

    # Convert standardized weights back to original-scale coefs (for interpretability)
    w_orig = w_std / sd
    intercept_orig = intercept - float(np.sum(w_std * mu / sd))

    # Cross-val RMSE (5-fold)
    rng = np.random.default_rng(7)
    idx = rng.permutation(n)
    folds = np.array_split(idx, 5)
    errs = []
    for k in range(5):
        test_idx = folds[k]
        train_idx = np.concatenate([folds[i] for i in range(5) if i != k])
        Xt = Xs[train_idx]
        yt = y[train_idx]
        At = Xt.T @ Xt + lam * np.eye(p)
        bt = Xt.T @ (yt - yt.mean())
        wk = np.linalg.solve(At, bt)
        pred = Xs[test_idx] @ wk + yt.mean()
        errs.append(np.sqrt(np.mean((pred - y[test_idx]) ** 2)))
    rmse_cv = float(np.mean(errs))

    coefs = dict(zip(FEATURES, w_orig.tolist()))
    coefs["__intercept__"] = intercept_orig
    return coefs, rmse_cv


def apply_xwoba(df: pd.DataFrame, coefs: dict) -> pd.DataFrame:
    out = df.copy()
    intercept = coefs["__intercept__"]
    pred = pd.Series(intercept, index=out.index)
    for f in FEATURES:
        pred = pred + out[f].fillna(out[f].mean()) * coefs[f]
    out["xwoba"] = pred
    out["woba_minus_xwoba"] = out["woba"] - out["xwoba"]
    return out


def scatter_plot(df: pd.DataFrame, role: str, division: str, min_pa: int) -> Path | None:
    """Save a wOBA-vs-xwOBA scatter, labelling the most over/underperforming."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib import font_manager
    except ImportError:
        return None

    for path in ["/System/Library/Fonts/STHeiti Light.ttc",
                 "/System/Library/Fonts/PingFang.ttc",
                 "/Library/Fonts/Arial Unicode.ttf"]:
        if Path(path).exists():
            font_manager.fontManager.addfont(path)
            plt.rcParams["font.family"] = font_manager.FontProperties(fname=path).get_name()
            break

    sub = df[df["pa"] >= min_pa].dropna(subset=["woba", "xwoba"]).copy()
    if sub.empty:
        return None

    fig, ax = plt.subplots(figsize=(9, 8))
    sizes = (sub["pa"].clip(lower=10).to_numpy() / 4)
    ax.scatter(sub["xwoba"], sub["woba"], s=sizes, alpha=0.55,
               c=sub["woba_minus_xwoba"], cmap="RdBu_r",
               vmin=-0.08, vmax=0.08, edgecolors="black", linewidth=0.4)

    # 1:1 diagonal
    lo = min(sub["xwoba"].min(), sub["woba"].min()) - 0.02
    hi = max(sub["xwoba"].max(), sub["woba"].max()) + 0.02
    ax.plot([lo, hi], [lo, hi], "k--", linewidth=1, alpha=0.5)

    # Annotate top 5 over/underperformers
    sub_sorted = sub.reindex(sub["woba_minus_xwoba"].abs().sort_values(ascending=False).index)
    for _, row in sub_sorted.head(8).iterrows():
        ax.annotate(row["name"], (row["xwoba"], row["woba"]),
                    fontsize=9, xytext=(5, 4), textcoords="offset points")

    ax.set_xlabel("xwOBA (估計真實能力)", fontsize=11)
    ax.set_ylabel("wOBA (實際表現)", fontsize=11)
    ax.set_title(f"CPBL {role} ({division}) wOBA vs xwOBA\n"
                 f"對角線下方=被低估；上方=被高估；點大小=PA", fontsize=12)
    ax.grid(True, alpha=0.3)
    ax.set_xlim(lo, hi)
    ax.set_ylim(lo, hi)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"xwoba_scatter_{role}_{division}_{int(time.time())}.png"
    fig.savefig(out, dpi=120, bbox_inches="tight")
    return out


def project(df: pd.DataFrame, regress_pa: int = 100, prior_woba: float | None = None) -> pd.DataFrame:
    """Bayesian shrinkage projection toward xwOBA (or league-mean if missing)."""
    out = df.copy()
    if prior_woba is None:
        prior_woba = float(out["xwoba"].mean())
    out["proj_woba"] = (
        (out["woba"].fillna(prior_woba) * out["pa"].fillna(0)
         + out["xwoba"].fillna(prior_woba) * regress_pa)
        / (out["pa"].fillna(0) + regress_pa)
    )
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--top", type=int, default=20)
    ap.add_argument("--role", choices=["batter", "pitcher", "all"], default="batter")
    ap.add_argument("--division", choices=["first", "second", "all"], default="first")
    ap.add_argument("--minpa", type=int, default=30)
    ap.add_argument("--regress-pa", type=int, default=100)
    ap.add_argument("--player", help="Show projection for one player ID")
    ap.add_argument("--save-csv", action="store_true")
    ap.add_argument("--plot", action="store_true",
                    help="Save wOBA vs xwOBA scatter plot")
    args = ap.parse_args()

    df = load()
    if args.role == "batter":
        df = df[df["position_code"] != "1"]
    elif args.role == "pitcher":
        df = df[df["position_code"] == "1"]
    if args.division == "first":
        df = df[~df["team_name"].str.contains("二軍", na=False)]
    elif args.division == "second":
        df = df[df["team_name"].str.contains("二軍", na=False)]

    coefs, rmse = fit_xwoba(df, min_pa=args.minpa)
    print(f"\nRidge xwOBA model trained on {(df['pa'] >= args.minpa).sum()} {args.role}s "
          f"(min PA={args.minpa}). 5-fold CV RMSE = {rmse:.4f}")
    print("\nCoefficients (per 1.0 unit increase in feature):")
    for f in FEATURES:
        sign = "+" if coefs[f] >= 0 else "−"
        print(f"  {f:<16}  {sign}{abs(coefs[f]):.4f}")
    print(f"  intercept       =  {coefs['__intercept__']:.4f}")

    df = apply_xwoba(df, coefs)
    df = project(df, regress_pa=args.regress_pa)
    df = df.dropna(subset=["xwoba"])

    cols = ["player_id", "name", "team_name", "position_name", "pa",
            "woba", "xwoba", "woba_minus_xwoba", "proj_woba"]

    if args.player:
        sub = df[df["player_id"] == args.player]
        if sub.empty:
            print(f"player {args.player} not found")
            return
        print("\n", sub[cols].to_string(index=False))
    else:
        sub = df[df["pa"] >= args.minpa].copy()
        sub = sub.sort_values("proj_woba", ascending=False).head(args.top)
        print(f"\nTop {args.top} {args.role}s by projected wOBA "
              f"(regress {args.regress_pa} PA toward xwOBA):\n")
        print(sub[cols].to_string(index=False, formatters={
            c: "{:.3f}".format for c in ["woba", "xwoba", "woba_minus_xwoba", "proj_woba"]
        }))

    if args.save_csv:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = OUT_DIR / "predictions.csv"
        df[cols].sort_values("proj_woba", ascending=False).to_csv(
            out_path, index=False
        )
        print(f"\n→ {out_path}")

    if args.plot:
        png = scatter_plot(df, args.role, args.division, args.minpa)
        if png:
            print(f"\nscatter → {png}")


if __name__ == "__main__":
    main()
