"""Minimal in-process rate limiting.

Scope note: state lives in this process only. With multiple uvicorn workers each holds
its own counters, so the effective limit is (limit x worker_count). That is still a
large improvement over no limit at all, but a shared Redis backend is required before
this can be relied on in production.
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class SlidingWindowLimiter:
    def __init__(self, max_events: int, window_seconds: float):
        self.max_events = max_events
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> tuple[bool, float]:
        """Record an attempt. Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] < cutoff:
                hits.popleft()
            if len(hits) >= self.max_events:
                return False, max(0.0, hits[0] + self.window_seconds - now)
            hits.append(now)

            # Opportunistic cleanup so idle keys don't accumulate forever.
            if len(self._hits) > 10_000:
                for stale in [k for k, v in self._hits.items() if not v or v[-1] < cutoff]:
                    del self._hits[stale]
            return True, 0.0

    def reset(self, key: str) -> None:
        """Clear a key — call after a successful login so users aren't punished."""
        with self._lock:
            self._hits.pop(key, None)


def _client_key(request: Request) -> str:
    client = request.client
    return client.host if client else "unknown"


def rate_limit(limiter: SlidingWindowLimiter, key_prefix: str):
    """Build a FastAPI dependency enforcing `limiter`, keyed by client address."""

    def dependency(request: Request) -> None:
        allowed, retry_after = limiter.check(f"{key_prefix}:{_client_key(request)}")
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please slow down and try again shortly.",
                headers={"Retry-After": str(int(retry_after) + 1)},
            )

    return dependency


# Credential stuffing / brute force protection.
login_limiter = SlidingWindowLimiter(max_events=10, window_seconds=300)
signup_limiter = SlidingWindowLimiter(max_events=5, window_seconds=3600)
# LLM calls are billed per request; cap them so one account cannot drain the quota.
llm_limiter = SlidingWindowLimiter(max_events=30, window_seconds=60)
