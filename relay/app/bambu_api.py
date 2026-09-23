from __future__ import annotations

import hashlib
import time

import requests

from .errors import AuthError, UpstreamError

API = "https://api.bambulab.com"
HEADERS = {"User-Agent": "bambu_network_agent/01.09.05.01"}
_cache: dict[str, tuple[float, str]] = {}


def get_username(token: str, session=requests, ttl: float = 600.0, now=time.monotonic) -> str:
    key = hashlib.sha256(token.encode()).hexdigest()
    hit = _cache.get(key)
    if hit and now() - hit[0] < ttl:
        return hit[1]
    try:
        r = session.get(f"{API}/v1/user-service/my/profile",
                        headers={**HEADERS, "Authorization": f"Bearer {token}"}, timeout=10)
    except requests.RequestException as e:
        raise UpstreamError(f"profile request failed: {e}") from e
    if r.status_code == 401:
        raise AuthError("token rejected")
    if r.status_code != 200:
        raise UpstreamError(f"profile HTTP {r.status_code}")
    uid = (r.json() or {}).get("uid")
    if not uid:
        raise UpstreamError("profile missing uid")
    user = f"u_{uid}"
    _cache[key] = (now(), user)
    if len(_cache) > 10_000:
        _cache.clear()
    return user
