"""Shared backend configuration for Bucket Jeju."""

from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SEED_DATA_PATH = PROJECT_ROOT / "frontend" / "seed-data" / "bucket-jeju-m3-seed.synthetic.json"
API_PREFIX = "/api/v1"
BUCKET_JEJU_LATITUDE = 33.2124518
BUCKET_JEJU_LONGITUDE = 126.2598287
SERVICE_RADIUS_METERS = 2_000
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY", "").strip()
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:8501,http://127.0.0.1:8501,http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
