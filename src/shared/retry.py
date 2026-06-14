from __future__ import annotations

import asyncio
import json
import logging
import time
import urllib.error
from typing import Awaitable, Callable, Optional, TypeVar

T = TypeVar("T")

logger = logging.getLogger(__name__)


def with_retry(
    fn: Callable[[], T],
    retries: int,
    retry_delay_seconds: float = 10.0,
) -> T:
    attempts = max(1, retries + 1)
    last_exc: Optional[Exception] = None
    for attempt in range(attempts):
        try:
            return fn()
        except urllib.error.HTTPError as exc:
            if exc.code != 429 and exc.code < 500:
                raise
            last_exc = exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_exc = exc

        if attempt < attempts - 1:
            logger.info(
                "API request failed, retrying in %.1fs (%d/%d): %s",
                retry_delay_seconds,
                attempt + 1,
                retries,
                last_exc,
            )
            time.sleep(retry_delay_seconds)

    assert last_exc is not None
    raise last_exc


async def with_retry_async(
    fn: Callable[[], Awaitable[T]],
    retries: int,
    retry_delay_seconds: float = 10.0,
) -> T:
    attempts = max(1, retries + 1)
    last_exc: Optional[Exception] = None
    for attempt in range(attempts):
        try:
            return await fn()
        except urllib.error.HTTPError as exc:
            if exc.code != 429 and exc.code < 500:
                raise
            last_exc = exc
        except (
            urllib.error.URLError,
            TimeoutError,
            asyncio.TimeoutError,
            OSError,
            json.JSONDecodeError,
        ) as exc:
            last_exc = exc

        if attempt < attempts - 1:
            logger.info(
                "API request failed, retrying in %.1fs (%d/%d): %s",
                retry_delay_seconds,
                attempt + 1,
                retries,
                last_exc,
            )
            await asyncio.sleep(retry_delay_seconds)

    assert last_exc is not None
    raise last_exc
