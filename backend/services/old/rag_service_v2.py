"""
RAG 서비스: 근거리 정보 조회 파이프라인.

=== 버전 이력 ===
[BASELINE] 2026-08-10 오전 : 최초 구현 (베이스라인 RAGAS 평가 대상)
[V1]       2026-08-10 오후 : _rerank() 버그 수정 (rag_service_v1.py)
[V2]                       : + 데이터 갭(약국/병원/마트) 가드 추가 (이 파일)
[V3]                       : + Multi-Query 검색 추가 (rag_service_v3.py)

=== V2에서 무엇을, 왜 고쳤나 ===


문제: V1 재평가 결과, 상세 로그 확인 결과 QA-04(약국)에서 존재하지 않는
      "붕 해물약국"을, TRAP-07(흡연 가능 식당)에서 존재하지 않는 "Cafe Leesle"을
      LLM이 지어내는 심각한 할루시네이션 발생. V1에서 추가한 "지어내지 마라"
      프롬프트 규칙만으로는 GPT-3.5-turbo가 정보가 없을 때 그럴듯한 이름을
      만들어내는 습성을 못 막음.
 
원인: 약국/병원/마트는 애초에 인덱스에 데이터 자체가 없는 카테고리
      (버스정류장과 달리 진짜 데이터 갭). 검색 결과가 없거나 무관해도
      LLM이 "직접 답하라"는 지시를 우선시해 구체적인 가짜 정보를 생성함.
 
수정 내용 (아래 [V1→V2] 표시된 부분):
  1. KNOWN_DATA_GAP_KEYWORDS 딕셔너리 신규 추가 (약국/병원/마트 키워드 매핑).
  2. _check_known_data_gap() 메서드 신규 추가.
  3. answer_query(): 맨 앞에서 데이터 갭 키워드 체크 → 해당되면 검색·LLM 생성을
     완전히 건너뛰고 고정 응답 반환 (프롬프트에만 의존하지 않고 코드로 원천 차단).
 
효과 (RAGAS 재평가 결과, V1 대비):
  faithfulness       0.592 → 0.620   (+2.7%p, 베이스라인 대비로는 +8.9%p)
  answer_relevancy   0.315 → 0.294   (-2.1%p)
  context_precision  0.521 → 0.476   (-4.5%p)
  context_recall     0.232 → 0.268   (+3.6%p)
 
  → faithfulness/recall은 개선, answer_relevancy/precision은 소폭 하락.
    약국/병원/마트 질문 3개가 검색 없이 빈 컨텍스트를 반환하면서
    RAGAS가 이를 "무관한 컨텍스트"에 가깝게 채점해 평균을 일부 깎은 것으로 추정.
    지어낸 답보다 "모른다"고 답하는 게 낫다는 판단 하에 감수한 트레이드오프.

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

# [V1→V2] 신규 추가: 인덱스에 데이터 자체가 없는 것으로 확인된 카테고리
# (약국/병원/마트 등). 이 카테고리는 검색/LLM 생성을 거치지 않고
# 고정 응답으로 즉시 처리한다.
# 이유: LLM에게 "모르면 모른다고 답하라"는 프롬프트 규칙(V1)만으로는 불충분함이
#       실제 평가에서 확인됨 (QA-04 "붕 해물약국", TRAP-07 "Cafe Leesle" 할루시네이션)
KNOWN_DATA_GAP_KEYWORDS = {
    "약국": "약국",
    "병원": "병원·응급실",
    "응급실": "병원·응급실",
    "마트": "대형마트",
    "하나로마트": "대형마트",
    "홍마트": "대형마트",
}


class RAGService:
    def __init__(self):
        """ChromaDB 인덱스와 OpenAI 클라이언트 초기화."""
        self.chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
        self.collection = self.chroma_client.get_collection(COLLECTION_NAME)
        self.openai_client = OpenAI()

    def search(self, query: str, top_k: int = 10) -> list[dict]:
        """
        사용자 쿼리로 관련 POI 검색. (V1과 동일, 변경 없음)

        1. 쿼리 임베딩 생성
        2. ChromaDB에서 상위 top_k개 검색 (이미 유사도순으로 정렬되어 반환됨)
        3. 유사도 순서를 유지한 채로 반환.

        Returns:
            [
                {
                    "name": "...",
                    "category_norm": "...",
                    "distance_m": 500,
                    "solo_friendly": True/False/None,
                    "description": "...",
                    "document": "...",
                    "similarity_score": 0.87,
                    "is_guesthouse_info": False,
                },
                ...
            ]
        """
        query_embedding = self.openai_client.embeddings.create(
            model=EMBED_MODEL, input=[query]
        ).data[0].embedding

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )

        search_results = []
        for doc, metadata, distance in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0]
        ):
            search_results.append({
                "name": metadata.get("name") or metadata.get("poi_name") or "",
                "category_norm": metadata.get("category_norm") or metadata.get("category") or "",
                "distance_m": metadata.get("distance_m", 0),
                "solo_friendly": self._parse_solo_friendly(metadata.get("solo_friendly")),
                "document": doc,
                "similarity_score": 1 - distance,
                "is_guesthouse_info": metadata.get("type") == "guesthouse_info",
            })

        search_results = self._rerank(search_results)

        return search_results

    def _parse_solo_friendly(self, value) -> Optional[bool]:
        """메타데이터의 solo_friendly 값을 bool로 변환. (V1과 동일, 변경 없음)"""
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
        보조 재순위화: 벡터 유사도 순위를 1차 기준으로 유지. (V1과 동일, 변경 없음)
        solo_friendly=False인 항목만 살짝 뒤로 미루는 정도의 약한 보정만 적용.
        """
        return sorted(
            results,
            key=lambda x: (x["solo_friendly"] is False,),
        )

    def _check_known_data_gap(self, query: str) -> Optional[str]:
        """
        [V1→V2: 신규 추가]
        인덱스에 아예 없는 것으로 확인된 카테고리(약국/병원/마트)인지 확인.
        해당되면 카테고리 라벨을 반환, 아니면 None.
        """
        for keyword, label in KNOWN_DATA_GAP_KEYWORDS.items():
            if keyword in query:
                return label
        return None

    def generate_response(self, query: str, search_results: list[dict], top_n: int = 3) -> str:
        """
        LLM으로 자연어 응답 생성. (V1과 동일, 변경 없음)
        """
        selected_results = search_results[:top_n]
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

    3. **사실 그라운딩 규칙**
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

        response = self.openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            max_tokens=500,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )

        return response.choices[0].message.content

    def _build_context(self, results: list[dict]) -> str:
        """검색 결과를 프롬프트 컨텍스트로 변환. (V1과 동일, 변경 없음)"""
        context_lines = []
        for idx, result in enumerate(results, 1):
            solo_status = (
                "1인 이용 적합" if result["solo_friendly"] is True
                else "1인 이용 부적합" if result["solo_friendly"] is False
                else "1인 이용 불명확"
            )

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

        Returns:
            {
                "query": "사용자 질문",
                "response": "LLM 답변 (자연어)",
                "search_results": [...]
            }
        """
        # [V1→V2: 신규 추가] 알려진 데이터 갭 카테고리는 검색/LLM 없이 즉시 고정 응답
        # (할루시네이션 방지 — 프롬프트 지시만으로는 막지 못함이 확인됨)
        gap_label = self._check_known_data_gap(query)
        if gap_label:
            return {
                "query": query,
                "response": (
                    f"죄송합니다, 현재 안내 가능한 정보에는 {gap_label} 데이터가 "
                    f"포함되어 있지 않습니다. 정확한 안내를 위해 프런트 데스크에 "
                    f"문의해주세요."
                ),
                "search_results": [],
            }

        # 1. 검색 (유사도 순위 유지)
        search_results = self.search(query)

        # 2. 응답 생성
        response = self.generate_response(query, search_results)

        return {
            "query": query,
            "response": response,
            "search_results": search_results[:3],
        }


# 스모크 테스트
if __name__ == "__main__":
    service = RAGService()

    test_queries = [
        "숙소 근처 혼밥 가능한 식당",
        "도보로 갈 수 있는 관광지",
        "가까운 편의점",
        "게스트하우스와 가장 가까운 정류장은 어디인가요?",
        "가장 가까운 약국이 어디야?",  # [V1→V2] 데이터 갭 가드 회귀 테스트용 추가
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
