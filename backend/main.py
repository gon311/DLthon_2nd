"""Bucket Jeju FastAPI application.

Run with: uvicorn backend.main:app --reload
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.config import ALLOWED_ORIGINS, API_PREFIX, SEED_DATA_PATH
from backend.models import HealthResponse, JoinListResponse
from backend.services.seed_repository import SeedRepository
from backend.services.rag_service import RAGService
from pydantic import BaseModel

app = FastAPI(title="Bucket Jeju API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allow_headers=["*"],
)
repository = SeedRepository(SEED_DATA_PATH)
rag_service = RAGService()

class AskRequest(BaseModel):
    question: str


@app.get("/health", response_model=HealthResponse, response_model_by_alias=True)
def health() -> HealthResponse:
    meta = repository.load()["_meta"]
    return HealthResponse(
        status="ok",
        guestCount=meta["guestCount"],
        joinCount=meta["joinRequestCount"],
        synthetic=meta["synthetic"],
    )


@app.get(f"{API_PREFIX}/joins", response_model=JoinListResponse, response_model_by_alias=True)
def list_joins(
    scheduled_date: str | None = Query(default=None, alias="scheduledDate"),
    status: str | None = None,
    keyword: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
) -> JoinListResponse:
    items = repository.joins()
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
    total = len(items)
    start = (page - 1) * page_size
    return JoinListResponse(
        items=items[start : start + page_size],
        total=total,
        page=page,
        pageSize=page_size,
        synthetic=True,
    )


@app.get(f"{API_PREFIX}/joins/{{join_id}}")
def get_join(join_id: str) -> dict:
    item = next((join for join in repository.joins() if join["id"] == join_id), None)
    if item is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "JOIN_NOT_FOUND", "message": "해당 Join을 찾을 수 없습니다."},
        )
    return item


@app.get(f"{API_PREFIX}/guests")
def list_guests() -> dict:
    guests = [
        {
            "id": guest["id"],
            "nickname": guest["nickname"],
            "checkInDate": guest["checkInDate"],
            "checkOutDate": guest["checkOutDate"],
            "roomNumber": guest["roomNumber"],
            "bedNumber": guest["bedNumber"],
            "profileKeywords": guest["profileKeywords"][:5],
            "stayVerificationStatus": guest["stayVerificationStatus"],
            "isSynthetic": True,
        }
        for guest in repository.guests()
    ]
    return {"items": guests, "total": len(guests), "synthetic": True}

@app.post(f"{API_PREFIX}/ask")
def ask(request: AskRequest) -> dict:
    result = rag_service.answer_query(request.question)
    return {
        "query": result["query"],
        "answer": result["response"],
        "sources": result["search_results"]
    }
