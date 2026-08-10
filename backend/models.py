"""API response models shared by the Join endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class JoinListResponse(BaseModel):
    items: list[dict[str, Any]]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(alias="pageSize", ge=1, le=100)
    synthetic: bool = True

    model_config = {"populate_by_name": True}


class HealthResponse(BaseModel):
    status: str
    guest_count: int = Field(alias="guestCount")
    join_count: int = Field(alias="joinCount")
    synthetic: bool

    model_config = {"populate_by_name": True}
