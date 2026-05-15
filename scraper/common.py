import json
import re
import time
from pathlib import Path

import requests

BASE_URL = "https://stats.cpbl.com.tw"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
}

POSITION_MAP = {
    "1": "投手", "2": "捕手", "3": "一壘手", "4": "二壘手", "5": "三壘手",
    "6": "游擊手", "7": "左外野手", "8": "中外野手", "9": "右外野手",
    "10": "指定打擊", "11": "代打",
}

_session = requests.Session()
_session.headers.update(HEADERS)


def fetch(url: str, retries: int = 3, backoff: float = 1.5) -> str:
    last_err = None
    for attempt in range(retries):
        try:
            r = _session.get(url, timeout=30)
            r.raise_for_status()
            return r.text
        except Exception as e:
            last_err = e
            time.sleep(backoff * (attempt + 1))
    raise RuntimeError(f"fetch failed: {url}: {last_err}")


_PUSH_RE = re.compile(r"self\.__next_f\.push\(\[(.*?)\]\)", re.DOTALL)


def extract_rsc_stream(html: str) -> str:
    """Concatenate the streamed RSC payload from a Next.js App Router page."""
    out = []
    for m in _PUSH_RE.findall(html):
        if "," not in m:
            continue
        _, tail = m.split(",", 1)
        tail = tail.strip()
        if tail.startswith('"'):
            try:
                decoded = json.loads(tail)
                if isinstance(decoded, str):
                    out.append(decoded)
            except json.JSONDecodeError:
                pass
    return "".join(out)


_LD_RE = re.compile(
    r'<script type="application/ld\+json"[^>]*>(.+?)</script>',
    re.DOTALL,
)


def extract_jsonld(html: str) -> list:
    blocks = []
    for raw in _LD_RE.findall(html):
        try:
            blocks.append(json.loads(raw))
        except json.JSONDecodeError:
            pass
    return blocks


def find_jsonld_in_stream(stream: str, type_name: str) -> dict | None:
    """Find a CollectionPage/Person/etc. JSON-LD object embedded in the RSC stream."""
    target = f'"@type":"{type_name}"'
    idx = stream.find(target)
    if idx < 0:
        return None
    start = stream.rfind("{", 0, idx)
    if start < 0:
        return None
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
                try:
                    return json.loads(stream[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None
