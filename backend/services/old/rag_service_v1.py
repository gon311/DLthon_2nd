"""
RAG 서비스: 근거리 정보 조회 파이프라인.

=== 버전 이력 ===
[BASELINE] 2026-08-10 오전 : 최초 구현 (베이스라인 RAGAS 평가 대상)
[V1]       2026-08-10 오후 : _rerank() 버그 수정 (이 파일)
[V2]                       : + 데이터 갭(약국/병원/마트) 가드 추가 (rag_service_v2.py)
[V3]                       : + Multi-Query 검색 추가 (rag_service_v3.py)

=== V1에서 무엇을, 왜 고쳤나 ===

문제: 베이스라인 RAGAS 결과 answer_relevancy 0.268, context_recall 0.196으로 심각하게 낮음.
      로그 분석 결과, 질문 내용과 무관하게 항상 같은 2~3개 식당이 반복 추천되거나
      게스트하우스 FAQ가 엉뚱하게 검색되는 패턴 확인.

원인: _rerank()가 벡터 유사도(similarity_score)를 완전히 무시하고
      solo_friendly(전체 문서가 True라 변별력 0) → distance_m 순으로만 재정렬.
      게스트하우스 FAQ 문서 30개는 전부 distance_m=0이라 항상 최우선으로 밀려 올라가고,
      나머지는 물리적으로 가장 가까운 POI 2~3곳이 질문과 무관하게 항상 선택됨.

수정 내용 (아래 [BASELINE→V1] 표시된 부분):
  1. _rerank(): 벡터 유사도 순서를 그대로 유지하도록 수정.
     solo_friendly==False인 것만 약하게 페널티, 나머지는 원래 순서(=유사도 순) 유지.
  2. search(): 결과에 is_guesthouse_info 플래그 추가, name 필드 fallback 보강.
  3. _build_context(): name이 빈 문자열인 항목(게스트하우스 FAQ)을
     "[숙소 내부 정보]"로 명시적 라벨링 → LLM이 빈칸을 임의 지어내는 것 방지.
  4. generate_response(): 프롬프트에 "검색 결과에 없는 걸 지어내지 마라" 규칙 추가,
     temperature=0 고정 (동일 질문에 매번 다른 답이 나오던 문제 방지).

효과 (RAGAS 재평가 결과, 베이스라인 대비):
  faithfulness       0.531 → 0.592   (+6.2%p)
  answer_relevancy   0.268 → 0.315   (+4.7%p)
  context_precision  0.426 → 0.521   (+9.5%p)
  context_recall     0.196 → 0.232   (+3.6%p)
 
  → 4개 지표 전부 개선. _rerank 버그 수정 하나로 골고루 좋아진, 가장 깨끗한 개선 단계.

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
        2. ChromaDB에서 상위 top_k개 검색 (이미 유사도순으로 정렬되어 반환됨)
        3. [BASELINE→V1] 유사도 순서를 유지한 채로 반환.
           solo_friendly/거리 보정은 _rerank에서 아주 약하게만 적용.

        Returns:
            [
                {
                    "name": "...",
                    "category_norm": "...",
                    "distance_m": 500,
                    "solo_friendly": True/False/None,
                    "description": "...",
                    "document": "...",       # 임베딩된 원본 문서
                    "similarity_score": 0.87,
                    "is_guesthouse_info": False,  # [BASELINE→V1] 추가
                },
                ...
            ]
        """
        # 1. 쿼리 임베딩
        query_embedding = self.openai_client.embeddings.create(
            model=EMBED_MODEL, input=[query]
        ).data[0].embedding

        # 2. ChromaDB 검색 (상위 top_k) — 결과는 이미 유사도 내림차순(거리 오름차순)으로 반환됨
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )

        # 3. 검색 결과 정리 (벡터 검색이 반환한 순서 = 유사도순 그대로 유지)
        search_results = []
        for doc, metadata, distance in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0]
        ):
            search_results.append({
                # [BASELINE→V1] name 필드 fallback 보강: metadata.get("name", "")에서
                # metadata.get("name") or metadata.get("poi_name") or ""로 변경
                # (정류장 문서처럼 name 대신 poi_name을 쓰는 케이스 대응)
                "name": metadata.get("name") or metadata.get("poi_name") or "",
                "category_norm": metadata.get("category_norm") or metadata.get("category") or "",
                "distance_m": metadata.get("distance_m", 0),
                "solo_friendly": self._parse_solo_friendly(metadata.get("solo_friendly")),
                "document": doc,
                "similarity_score": 1 - distance,  # ChromaDB는 거리값을 반환, 유사도 = 1 - 거리
                # [BASELINE→V1] 신규 필드: 게스트하우스 FAQ 여부 플래그
                "is_guesthouse_info": metadata.get("type") == "guesthouse_info",
            })

        # 4. [BASELINE→V1] 유사도 순위를 깨뜨리지 않는 선에서만 보조 재순위화
        #    (기존에는 이 자리에서 solo_friendly→거리 순으로 전체 재정렬했음)
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
        [BASELINE→V1: 핵심 수정] 보조 재순위화. 벡터 유사도 순위를 1차 기준으로 유지.

        --- 베이스라인의 버그 ---
        def _rerank(self, results):
            true_results = sorted(
                [r for r in results if r["solo_friendly"] is True],
                key=lambda x: x["distance_m"]
            )
            none_results = sorted(...)
            false_results = sorted(...)
            return true_results + none_results + false_results

        전체 51개 문서가 실제로는 전부 solo_friendly=True라 이 필드는 변별력이 0이었고,
        결과적으로 distance_m(물리적 거리) 하나만으로 전체를 재정렬하는 것과 같았음.
        게스트하우스 FAQ 30개는 전부 distance_m=0이라 항상 최우선으로 올라가고,
        나머지는 물리적으로 가장 가까운 POI 2~3곳이 질문 내용과 무관하게 항상 선택됨.
        (예: "가장 가까운 병원은?" 질문에도 대정쌍둥이식당(102m)이 반복 추천됨)

        --- V1 수정 ---
        벡터 검색이 이미 계산한 유사도 순서(입력 results의 순서)를 기본으로 존중.
        solo_friendly=False인 항목만 살짝 뒤로 미루는 정도의 약한 보정만 적용.
        distance_m=0(게스트하우스 자체 정보)이라는 이유만으로 순위를 올리지 않음.
        """
        # solo_friendly가 False로 명시된 것만 페널티, 나머지(True/None)는
        # 벡터 유사도 순서를 그대로 유지 (Python sorted()는 stable sort)
        return sorted(
            results,
            key=lambda x: (x["solo_friendly"] is False,),
        )

    def generate_response(self, query: str, search_results: list[dict], top_n: int = 3) -> str:
        """
        LLM으로 자연어 응답 생성.

        Args:
            query: 사용자 쿼리
            search_results: RAG 검색 결과 (유사도 기준 정렬된)
            top_n: 응답에 포함할 항목 개수 (기본 3개)

        Returns:
            LLM이 생성한 자연어 응답 (Streamlit에서 바로 표시 가능)
        """
        # 상위 top_n개 선정 (이제 유사도 순위 기준)
        selected_results = search_results[:top_n]

        # 프롬프트 구성
        context = self._build_context(selected_results)
        
        prompt = f"""당신은 제주 버킷 게스트하우스 투숙객을 위한 정보 제공 어시스턴트입니다.

    사용자 질문: {query}

    검색 결과:
    {context}

    ## 응답 규칙

    1. **숙소 내부 정보 (거리: 0m, "[숙소 내부 정보]"로 표시된 항목)가 있으면 우선 직답**
    - 예: "숙소의 공용 와이파이 비밀번호는 bucket1234입니다."
    - 예: "세탁기는 무료로 사용할 수 있습니다. 세탁실은 1층 식당 안쪽에 있습니다."

    2. **근처 장소는 자연어 문장으로**
    - 각 장소의 특징, 거리, 1인 이용 가능 여부를 자연스럽게 설명
    - 마크다운 불릿(-, *) 사용 금지
    - 예: "근처에는 대정쌍둥이식당이 숙소에서 약 102m 거리에 있으며, 저렴한 가격에 맛난 한식을 즐길 수 있습니다."

    3. **[BASELINE→V1: 신규 추가] 사실 그라운딩 규칙**
    - 아래 "검색 결과"에 실제로 적힌 이름·거리·시간·수치만 사용하세요.
    - 검색 결과에 없는 장소명, 숫자, 시간, 특징을 절대 지어내지 마세요.
    - 검색 결과가 질문과 관련이 없다면, 억지로 답을 만들지 말고
      "제공된 정보로는 정확히 답변드리기 어렵습니다. 프런트 데스크에 문의해주세요."
      라고 답하세요.

    4. **응답 형식**
    - 자연어 문장만 사용 (마크다운 형식 금지)
    - 간결하고 명확하게
    - 조인 서비스 언급 금지

    응답:"""

        # [BASELINE→V1] LLM 호출 — temperature=0으로 고정 (베이스라인엔 temperature 미설정 → 기본값 1.0)
        response = self.openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            max_tokens=500,
            temperature=0,
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

            # [BASELINE→V1] 신규 추가: 게스트하우스 FAQ 항목은 metadata에 name이 없어
            # 베이스라인에서는 빈 문자열이 그대로 프롬프트에 들어갔고,
            # LLM이 그 빈칸을 임의의 장소명으로 지어내는 원인이 되었음
            # (예: "성산읍사무소 정류장"처럼 컬렉션에 존재하지 않는 이름을 생성).
            if result.get("is_guesthouse_info") or not result["name"]:
                name_label = "[숙소 내부 정보]"
            else:
                name_label = result["name"]

            line = (
                f"{idx}. {name_label} ({result['category_norm']})\n"
                f"   - 거리: 약 {result['distance_m']}m\n"
                f"   - 상태: {solo_status}\n"
                f"   - 설명: {result['document']}"
            )
            context_lines.append(line)
        return "\n".join(context_lines)

    def answer_query(self, query: str) -> dict:
        """
        사용자 쿼리에 대한 완전한 답변.

        [V1에서는 베이스라인과 동일] 데이터 갭 가드는 V2에서 추가됨.

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
        # 1. 검색 (유사도 순위 유지)
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
        "게스트하우스와 가장 가까운 정류장은 어디인가요?",  # [BASELINE→V1] 회귀 테스트용 추가
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
                f"- {poi['distance_m']}m [{solo_status}] "
                f"sim={poi['similarity_score']:.3f}"
            )
