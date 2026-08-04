"""
RAG 서비스: 근거리 정보 조회 파이프라인.

흐름:
1. 사용자 쿼리 임베딩 → ChromaDB 검색 (상위 10개)
2. solo_friendly 기준 재순위화 (True > None > False)
3. 거리 기준 재순위화 (가까운 순)
4. 상위 3개 선정
5. LLM으로 자연어 응답 생성 (각 POI 설명 포함)

출력: 자연어 응답 (Streamlit에서 바로 표시 가능)

사용법:
    export PYTHONPATH="${PYTHONPATH}:$(pwd)"
    python backend/services/rag_service.py
"""

import json
import os 
from typing import Optional

import chromadb
from openai import OpenAI

from backend.utils.geo import LODGING_LAT, LODGING_LNG, haversine_m

CHROMA_PATH = "data/index/chroma"
COLLECTION_NAME = "poi"
EMBED_MODEL = "text-embedding-3-small"

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]

class RAGService:
    def __init__(self):
        """ChromaDB 인덱스와 OpenAI 클라이언트 초기화."""
        self.chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
        self.collection = self.chroma_client.get_collection(COLLECTION_NAME)
        self.openai_client = OpenAI()

    def search(self, query: str, top_k: int = 10) -> list[dict]:
        """
        사용자 쿼리로 관련 POI 검색.

        1. 쿼리 임베딩 생성
        2. ChromaDB에서 상위 top_k개 검색
        3. solo_friendly 기준 재순위화
        4. 거리 기준 재순위화

        Returns:
            [
                {
                    "name": "...",
                    "category_norm": "...",
                    "distance_m": 500,
                    "solo_friendly": True/False/None,
                    "description": "...",
                    "document": "..."  # 임베딩된 원본 문서
                },
                ...
            ]
        """
        # 1. 쿼리 임베딩
        query_embedding = self.openai_client.embeddings.create(
            model=EMBED_MODEL, input=[query]
        ).data[0].embedding

        # 2. ChromaDB 검색 (상위 top_k)
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )

        # 3. 검색 결과 정렬 (거리 역순 → 가장 유사한 것부터)
        search_results = []
        for doc, metadata, distance in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0]
        ):
            search_results.append({
                "name": metadata.get("name", ""),
                "category_norm": metadata.get("category_norm", ""),
                "distance_m": metadata.get("distance_m", 0),
                "solo_friendly": self._parse_solo_friendly(metadata.get("solo_friendly")),
                "document": doc,
                "similarity_score": 1 - distance,  # ChromaDB는 거리값을 반환, 유사도 = 1 - 거리
            })

        # 4. 재순위화: solo_friendly (True > None > False) → 거리 (가까운 순)
        search_results = self._rerank(search_results)

        return search_results

    def _parse_solo_friendly(self, value) -> Optional[bool]:
        """메타데이터의 solo_friendly 값을 bool로 변환."""
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            if value.lower() == "true":
                return True
            elif value.lower() == "false":
                return False
        return None

    def _rerank(self, results: list[dict]) -> list[dict]:
        """
        재순위화: solo_friendly 우선도 > 거리
        
        우선도:
        1. solo_friendly == True (거리순)
        2. solo_friendly == None (거리순)
        3. solo_friendly == False (거리순)
        """
        true_results = sorted(
            [r for r in results if r["solo_friendly"] is True],
            key=lambda x: x["distance_m"]
        )
        none_results = sorted(
            [r for r in results if r["solo_friendly"] is None],
            key=lambda x: x["distance_m"]
        )
        false_results = sorted(
            [r for r in results if r["solo_friendly"] is False],
            key=lambda x: x["distance_m"]
        )

        return true_results + none_results + false_results

    def generate_response(self, query: str, search_results: list[dict], top_n: int = 3) -> str:
        """
        LLM으로 자연어 응답 생성.

        Args:
            query: 사용자 쿼리
            search_results: RAG 검색 결과 (재순위화된)
            top_n: 응답에 포함할 POI 개수 (기본 3개)

        Returns:
            LLM이 생성한 자연어 응답 (Streamlit에서 바로 표시 가능)
        """
        # 상위 top_n개 선정
        selected_results = search_results[:top_n]

        # 프롬프트 구성
        context = self._build_context(selected_results)
        prompt = f"""사용자가 게스트하우스 근처에서 다음을 찾고 있습니다:

사용자 요청: {query}

추천할 수 있는 장소들:
{context}

위 정보를 바탕으로 자연스러운 한국어로 추천해주세요. 각 장소에 대해:
- 상호명과 특징
- 거리 (숙소로부터 몇 미터)
- 1인 이용 가능 여부 (solo_friendly가 False면 "1인 이용이 어려울 수 있습니다"라고 명시)

만약 1인 이용이 어려운 장소가 있다면, 조인 서비스를 이용하는 것도 좋은 방법임을 언급해주세요.

응답은 읽기 좋도록 마크다운 형식으로 작성해주세요."""

        # LLM 호출
        response = self.openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )

        return response.choices[0].message.content

    def _build_context(self, results: list[dict]) -> str:
        """검색 결과를 프롬프트 컨텍스트로 변환."""
        context_lines = []
        for idx, result in enumerate(results, 1):
            solo_status = (
                "1인 이용 적합" if result["solo_friendly"] is True
                else "1인 이용 부적합" if result["solo_friendly"] is False
                else "1인 이용 불명확"
            )
            line = (
                f"{idx}. {result['name']} ({result['category_norm']})\n"
                f"   - 거리: 약 {result['distance_m']}m\n"
                f"   - 상태: {solo_status}\n"
                f"   - 설명: {result['document']}"
            )
            context_lines.append(line)
        return "\n".join(context_lines)

    def answer_query(self, query: str) -> dict:
        """
        사용자 쿼리에 대한 완전한 답변.

        Returns:
            {
                "query": "사용자 질문",
                "response": "LLM 답변 (자연어)",
                "search_results": [
                    {
                        "name": "...",
                        "category_norm": "...",
                        "distance_m": 500,
                        "solo_friendly": True/False/None,
                        "document": "..."
                    },
                    ...
                ]
            }
        """
        # 1. 검색
        search_results = self.search(query)

        # 2. 응답 생성
        response = self.generate_response(query, search_results)

        return {
            "query": query,
            "response": response,
            "search_results": search_results[:3],  # 상위 3개만 반환
        }


# 스모크 테스트
if __name__ == "__main__":
    service = RAGService()

    test_queries = [
        "숙소 근처 혼밥 가능한 식당",
        "도보로 갈 수 있는 관광지",
        "가까운 편의점",
    ]

    for query in test_queries:
        print(f"\n{'='*60}")
        print(f"쿼리: {query}")
        print(f"{'='*60}")

        result = service.answer_query(query)
        print(result["response"])

        print("\n[검색 결과 상세]")
        for idx, poi in enumerate(result["search_results"], 1):
            solo_status = (
                "✓ 1인 적합" if poi["solo_friendly"] is True
                else "✗ 1인 부적합" if poi["solo_friendly"] is False
                else "? 불명확"
            )
            print(
                f"{idx}. {poi['name']} ({poi['category_norm']}) "
                f"- {poi['distance_m']}m [{solo_status}]"
            )
