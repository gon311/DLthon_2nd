"""Read-only repository for the reproducible synthetic M3 dataset."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


class SeedRepository:
    def __init__(self, path: Path) -> None:
        self.path = path

    @lru_cache(maxsize=1)
    def load(self) -> dict[str, Any]:
        with self.path.open("r", encoding="utf-8") as seed_file:
            payload = json.load(seed_file)
        if payload.get("_meta", {}).get("synthetic") is not True:
            raise ValueError("Seed dataset must be explicitly marked as synthetic.")
        return payload

    def guests(self) -> list[dict[str, Any]]:
        return self.load()["guests"]

    def joins(self) -> list[dict[str, Any]]:
        return self.load()["joinRequests"]
