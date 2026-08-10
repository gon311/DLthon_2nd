"""Small API client with a local synthetic-seed fallback."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1").rstrip("/")
SEED_PATH = Path(__file__).resolve().parent / "seed-data" / "bucket-jeju-m3-seed.synthetic.json"


def _local_joins() -> list[dict[str, Any]]:
    with SEED_PATH.open("r", encoding="utf-8") as seed_file:
        return json.load(seed_file)["joinRequests"]


def fetch_joins(
    *,
    scheduled_date: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
    page_size: int = 100,
) -> tuple[list[dict[str, Any]], str]:
    query: dict[str, str | int] = {"pageSize": page_size}
    if scheduled_date:
        query["scheduledDate"] = scheduled_date
    if status:
        query["status"] = status
    if keyword:
        query["keyword"] = keyword
    try:
        with urlopen(f"{API_BASE_URL}/joins?{urlencode(query)}", timeout=3) as response:
            return json.load(response)["items"], "api"
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError):
        items = _local_joins()
        if scheduled_date:
            items = [item for item in items if item["scheduledDate"] == scheduled_date]
        if status:
            items = [item for item in items if item["status"] == status]
        if keyword:
            normalized = keyword.casefold()
            items = [
                item for item in items
                if normalized in item["title"].casefold()
                or any(normalized in value.casefold() for value in item["keywords"])
            ]
        return items, "seed-fallback"
