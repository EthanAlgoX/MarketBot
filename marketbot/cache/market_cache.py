"""Market data caching layer for efficient data retrieval."""

from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from loguru import logger


class MarketCache:
    """Cache layer for market data to reduce API calls and improve response time."""

    def __init__(self, workspace: Path, ttl_seconds: int = 60):
        self.cache_dir = workspace / ".cache" / "market"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl_seconds = ttl_seconds
        self._memory_cache: dict[str, tuple[Any, datetime]] = {}
        self._lock = asyncio.Lock()

    def _get_cache_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate a unique cache key."""
        key_data = f"{prefix}:{args}:{sorted(kwargs.items())}"
        return hashlib.md5(key_data.encode()).hexdigest()

    def _get_cache_path(self, key: str) -> Path:
        """Get file path for cache key."""
        return self.cache_dir / f"{key}.json"

    def get(self, prefix: str, *args, **kwargs) -> Any | None:
        """Get value from cache (memory first, then disk)."""
        key = self._get_cache_key(prefix, *args, **kwargs)

        if key in self._memory_cache:
            value, timestamp = self._memory_cache[key]
            if datetime.now() - timestamp < timedelta(seconds=self.ttl_seconds):
                logger.debug("Cache hit (memory): {}", key[:8])
                return value
            else:
                del self._memory_cache[key]

        cache_path = self._get_cache_path(key)
        if cache_path.exists():
            try:
                data = json.loads(cache_path.read_text())
                cached_at = datetime.fromisoformat(data["cached_at"])
                if datetime.now() - cached_at < timedelta(seconds=self.ttl_seconds):
                    self._memory_cache[key] = (data["value"], cached_at)
                    logger.debug("Cache hit (disk): {}", key[:8])
                    return data["value"]
                else:
                    cache_path.unlink()
            except Exception:
                pass

        return None

    def set(self, value: Any, prefix: str, *args, **kwargs) -> None:
        """Set value in cache (memory and disk)."""
        key = self._get_cache_key(prefix, *args, **kwargs)
        timestamp = datetime.now()

        self._memory_cache[key] = (value, timestamp)

        cache_path = self._get_cache_path(key)
        try:
            cache_path.write_text(json.dumps({
                "value": value,
                "cached_at": timestamp.isoformat(),
            }))
        except Exception:
            logger.warning("Failed to write cache to disk")

    def invalidate(self, prefix: str, *args, **kwargs) -> None:
        """Invalidate a specific cache entry."""
        key = self._get_cache_key(prefix, *args, **kwargs)

        if key in self._memory_cache:
            del self._memory_cache[key]

        cache_path = self._get_cache_path(key)
        if cache_path.exists():
            cache_path.unlink()

    def clear(self) -> None:
        """Clear all cache."""
        self._memory_cache.clear()
        for f in self.cache_dir.glob("*.json"):
            f.unlink()
        logger.info("Market cache cleared")

    async def get_or_fetch(
        self,
        prefix: str,
        fetch_func: callable,
        *args,
        **kwargs
    ) -> Any:
        """Get from cache or fetch if not exists."""
        cached = self.get(prefix, *args, **kwargs)
        if cached is not None:
            return cached

        async with self._lock:
            cached = self.get(prefix, *args, **kwargs)
            if cached is not None:
                return cached

            logger.debug("Cache miss, fetching: {}{}", prefix, args[:1] if args else "")
            value = await fetch_func(*args, **kwargs) if asyncio.iscoroutinefunction(fetch_func) else fetch_func(*args, **kwargs)
            self.set(value, prefix, *args, **kwargs)
            return value


class SymbolCache:
    """Specialized cache for symbol/quote data with market hours awareness."""

    def __init__(self, workspace: Path):
        self.market_cache = MarketCache(workspace, ttl_seconds=60)
        self.workspace = workspace

    def get_quote(self, symbol: str) -> dict | None:
        """Get cached quote for symbol."""
        return self.market_cache.get("quote", symbol)

    def set_quote(self, symbol: str, quote: dict) -> None:
        """Cache quote for symbol."""
        self.market_cache.set(quote, "quote", symbol)

    def get_news(self, symbol: str, max_age_days: int = 3) -> list | None:
        """Get cached news for symbol."""
        return self.market_cache.get("news", symbol)

    def set_news(self, symbol: str, news: list) -> None:
        """Cache news for symbol."""
        self.market_cache.set(news, "news", symbol)

    def invalidate_symbol(self, symbol: str) -> None:
        """Invalidate all cache for a symbol."""
        self.market_cache.invalidate("quote", symbol)
        self.market_cache.invalidate("news", symbol)
