"""Extract React Query (Tanstack) dehydrated entries from a Next.js RSC stream.

Each entry has the shape::

    {"dehydratedAt": ..., "state": {"data": ...}, "queryKey": [...], ...}

We locate these by scanning for the ``"queryKey":[`` marker and walking
back to the enclosing ``{``.
"""
from __future__ import annotations

import json
import re
from typing import Iterator


def _balanced(stream: str, start: int, open_c: str = "{", close_c: str = "}") -> str | None:
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
        if ch == open_c:
            depth += 1
        elif ch == close_c:
            depth -= 1
            if depth == 0:
                return stream[start : i + 1]
    return None


def _find_enclosing_object_start(stream: str, idx: int) -> int:
    """Walk backwards from ``idx`` to find the index of the enclosing '{' at depth 0."""
    depth = 0
    in_str = False
    i = idx
    while i >= 0:
        ch = stream[i]
        if ch == '"' and (i == 0 or stream[i - 1] != "\\"):
            in_str = not in_str
        elif not in_str:
            if ch == "}":
                depth += 1
            elif ch == "{":
                if depth == 0:
                    return i
                depth -= 1
        i -= 1
    return -1


def iter_queries(stream: str) -> Iterator[dict]:
    """Yield parsed dehydrated query entries from ``stream``.

    React-Query dehydrated entries start with ``{"dehydratedAt":<num>,``.
    """
    for m in re.finditer(r'\{"dehydratedAt":', stream):
        raw = _balanced(stream, m.start())
        if raw is None:
            continue
        try:
            yield json.loads(raw)
        except json.JSONDecodeError:
            continue


def get_query(stream: str, key_prefix: str) -> dict | None:
    """Return the first query whose ``queryKey[0]`` matches ``key_prefix``."""
    for q in iter_queries(stream):
        qk = q.get("queryKey") or []
        if qk and qk[0] == key_prefix:
            return q
    return None


def get_queries(stream: str, key_prefix: str) -> list[dict]:
    return [
        q for q in iter_queries(stream)
        if (q.get("queryKey") or [None])[0] == key_prefix
    ]
