"""Thin wrapper around the stats.cpbl.com.tw `/api/proxy` backend.

Endpoints discovered by inspecting the SPA's JS bundles:

* ``/v1/leaderboards/pr-table``
* ``/v1/leaderboards/batted-ball``
* ``/v1/leaderboards/exit-velocity``
* ``/v1/leaderboards/pitch-tracking``
* ``/v1/games/schedule/<YYYY-MM-DD>``
* ``/v1/games/<gameId>``
* ``/v1/players/autocomplete``

Responses are wrapped as ``{"Data": ...}`` (PascalCase). Empty filter values
are stripped client-side.
"""
from __future__ import annotations

import time
import urllib.parse
from typing import Any

import requests

from common import HEADERS

API_BASE = "https://stats.cpbl.com.tw/api/proxy"

_session = requests.Session()
_session.headers.update({**HEADERS, "Accept": "application/json"})


def _request(path: str, params: dict | None = None, retries: int = 3) -> Any:
    # The SPA strips empty string, 0, and null values before sending the
    # request; the backend rejects them otherwise.
    if params is not None:
        params = {k: v for k, v in params.items() if v not in (None, "", 0)}
    url = f"{API_BASE}{path}"
    last = None
    for i in range(retries):
        try:
            r = _session.get(url, params=params, timeout=30)
            r.raise_for_status()
            data = r.json()
            if isinstance(data, dict) and data.get("success") is False:
                raise RuntimeError(f"API error: {data}")
            return data
        except Exception as e:
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"API request failed: {url} params={params} :: {last}")


def _unwrap(resp: Any) -> Any:
    """Strip the ``Data`` envelope and return the inner payload."""
    if isinstance(resp, dict):
        for k in ("Data", "data"):
            if k in resp:
                return resp[k]
    return resp


_LEADERBOARD_DEFAULTS = {
    "year": None,
    "month": 0,
    "gameKind": "A",
    "teamCode": "",
    "opponentTeamCode": "",
    "defendStationCode": "",
    "batSide": "",
    "pitchHand": "",
    "fieldAbbe": "",
    "pitchType": "",
    "playerAcnt": "",
}


def pr_table(year: int, search_type: str = "batter", game_kind: str = "A",
             **filters: Any) -> list[dict]:
    """Return the season pr-table leaderboard.

    ``search_type``: "batter" or "pitcher".
    ``game_kind``:   "A" (一軍 例行賽), "D" (二軍 例行賽), "B" (季後賽) etc.
    """
    params = {**_LEADERBOARD_DEFAULTS, "year": year,
              "searchType": search_type, "gameKind": game_kind, **filters}
    resp = _request("/v1/leaderboards/pr-table", params)
    inner = _unwrap(resp)
    if isinstance(inner, dict) and "Leaderboard" in inner:
        return inner["Leaderboard"]
    return inner if isinstance(inner, list) else []


def batted_ball(year: int, search_type: str = "batter", game_kind: str = "A",
                **filters: Any) -> list[dict]:
    params = {**_LEADERBOARD_DEFAULTS, "year": year,
              "searchType": search_type, "gameKind": game_kind, **filters}
    resp = _request("/v1/leaderboards/batted-ball", params)
    inner = _unwrap(resp)
    if isinstance(inner, dict) and "Leaderboard" in inner:
        return inner["Leaderboard"]
    return inner if isinstance(inner, list) else []


def exit_velocity(year: int, search_type: str = "batter", game_kind: str = "A",
                  **filters: Any) -> list[dict]:
    params = {**_LEADERBOARD_DEFAULTS, "year": year,
              "searchType": search_type, "gameKind": game_kind, **filters}
    resp = _request("/v1/leaderboards/exit-velocity", params)
    inner = _unwrap(resp)
    if isinstance(inner, dict) and "Leaderboard" in inner:
        return inner["Leaderboard"]
    return inner if isinstance(inner, list) else []


def pitch_tracking(year: int, game_kind: str = "A", **filters: Any) -> list[dict]:
    params = {**_LEADERBOARD_DEFAULTS, "year": year,
              "gameKind": game_kind, **filters}
    params.pop("searchType", None)
    params.pop("opponentTeamCode", None)
    params.pop("defendStationCode", None)
    params.pop("batSide", None)
    resp = _request("/v1/leaderboards/pitch-tracking", params)
    inner = _unwrap(resp)
    if isinstance(inner, dict) and "Leaderboard" in inner:
        return inner["Leaderboard"]
    return inner if isinstance(inner, list) else []


def schedule(date: str) -> list[dict]:
    """``date`` in ``YYYY-MM-DD`` form."""
    resp = _request(f"/v1/games/schedule/{date}")
    inner = _unwrap(resp)
    if isinstance(inner, dict) and "Games" in inner:
        return inner["Games"]
    return inner if isinstance(inner, list) else []


def game(game_id: str) -> dict:
    resp = _request(f"/v1/games/{game_id}")
    inner = _unwrap(resp)
    if isinstance(inner, dict) and "Game" in inner:
        return inner["Game"]
    return inner if isinstance(inner, dict) else {}


def player_autocomplete(q: str) -> list[dict]:
    resp = _request("/v1/players/autocomplete", {"q": q})
    inner = _unwrap(resp)
    return inner if isinstance(inner, list) else []
