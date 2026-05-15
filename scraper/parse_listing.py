"""Parse the /players listing page into the 448-player roster.

The page embeds two roster representations in its RSC stream:

* A JSON-LD ``CollectionPage`` with only the first 50 ``ItemList`` entries.
* A raw API payload keyed by ``acnt`` (account id) with all 448 players.

We prefer the API payload because it has more fields (uniform number,
position code, team code, retirement date) and the full roster.
"""
from __future__ import annotations

import json
import re

from common import POSITION_MAP, extract_rsc_stream

_PLAYER_RE = re.compile(r'\{"acnt":"\d{10}"')


def _balanced_object(stream: str, start: int) -> str | None:
    """Return the JSON object beginning at index ``start`` in ``stream``."""
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(stream)):
        ch = stream[i]
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return stream[start : i + 1]
    return None


def parse_listing_html(html: str) -> list[dict]:
    stream = extract_rsc_stream(html)
    seen: dict[str, dict] = {}
    for m in _PLAYER_RE.finditer(stream):
        raw = _balanced_object(stream, m.start())
        if raw is None:
            continue
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError:
            continue
        pid = obj.get("acnt")
        if not pid:
            continue
        team = obj.get("team") or {}
        rec = {
            "player_id": pid,
            "name": obj.get("chName"),
            "name_en": obj.get("engname"),
            "aboriginal_name": obj.get("aboriginalName") or None,
            "jersey_number": obj.get("uniformNo"),
            "image_url": obj.get("acntImgPath"),
            "position_code": obj.get("defendStation"),
            "position_name": POSITION_MAP.get(str(obj.get("defendStation") or ""), ""),
            "retired_date": obj.get("retiredDate"),
            "team_code": team.get("code"),
            "team_name": team.get("name"),
            "team_logo_small": team.get("smallLogoUrl"),
            "team_logo_big": team.get("bigLogoUrl"),
            "url": f"https://stats.cpbl.com.tw/players/{pid}",
        }
        # Prefer the richest record. Sparse references (e.g. winning-pitcher
        # snippets inside game objects) only have ``acnt`` + ``name``; the
        # full roster record has uniformNo, defendStation, team, etc.
        if pid not in seen or rec.get("jersey_number") or rec.get("team_code"):
            if pid in seen:
                prev = seen[pid]
                merged = {k: (rec.get(k) or prev.get(k)) for k in rec}
                seen[pid] = merged
            else:
                seen[pid] = rec
    return list(seen.values())
