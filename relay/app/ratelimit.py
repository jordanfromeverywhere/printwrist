class RateLimiter:
    def __init__(self, min_interval: float):
        self.min_interval = min_interval
        self._last: dict[str, float] = {}

    def allow(self, key: str, now: float) -> bool:
        last = self._last.get(key)
        if last is not None and now - last < self.min_interval:
            return False
        if len(self._last) > 10_000:
            self._last.clear()
        self._last[key] = now
        return True
