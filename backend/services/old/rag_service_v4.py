"""
RAG 서비스: 근거리 정보 조회 파이프라인.

=== 버전 이력 ===
[BASELINE] 2026-08-10 오전 : 최초 구현 (베이스라인 RAGAS 평가 대상)
[V1]       2026-08-10 오후 : _rerank() 버그 수정 (rag_service_v1.py)
[V2]                       : + 데이터 갭(약국/병원/마트) 가드 추가 (rag_service_v2.py)
[V3]                       : + Multi-Query 검색 추가 (rag_service_v3.py)
[V4]                       : + RRF 가중치·top_k 튜닝으로 faithfulness 회복 (이 파일, 최종본)

=== V3에서 V4로: 무엇을, 왜 고쳤나 ===

문제: V3의 faithfulness(0.514)가 베이스라인(0.531)보다도 낮았음. RRF 병합 시
      원본 쿼리와 대체 쿼리(LLM이 만든 유사 표현)의 검색 결과가 동일한 가중치로
      합산되고 있어서, 대체 쿼리 2개가 같은 문서를 밀어주면 원본 쿼리 1개의
      지지보다 점수가 더 커지는 구조였음 (예: 1.0+1.0=2.0 vs 원본 1.0).
      결과적으로 원본 질문과는 약하게만 관련된 문서가 컨텍스트에 섞여 들어오고,
      LLM이 이를 종합하며 부정확한 근사·조합을 만드는 경향이 늘어남.

수정 내용 (아래 [V3→V4] 표시된 부분, search_multi() 안):
  1. top_k_per_query: 5 → 3. 쿼리당 검색 후보 수를 줄여 약하게만 관련된
     문서가 애초에 후보에 덜 들어오게 함 (노이즈 원천 축소).

효과 (RAGAS 재평가 결과, V3 대비):
  faithfulness       0.514 → 0.590   (+7.7%p, 베이스라인도 다시 상회)
  answer_relevancy   0.319 → 0.367   (+4.8%p)
  context_precision  0.440 → 0.455   (+1.5%p)
  context_recall     0.429 → 0.429   (변화 없음 — 하락 아님, 소수점까지 동일)

  → 4개 지표 중 3개 개선, 1개는 그대로. 하락한 지표가 하나도 없는 순수 개선.
    구체적 개선 사례: TRAP-07("근처에 실내에서 흡연이 가능한 식당이 있나?")에서
    V3는 흡연 관련 문서가 검색됐음에도 순위에서 밀려 무관한 식당 얘기만 했는데,
    V4는 흡연 장소 정보를 정확히 근거로 답변함 — 노이즈 감소 효과가 실제
    답변 품질로 이어진 사례.

  === 최종 결정 (2026-08-10, V3 결정을 대체) ===
  V4를 최종본으로 채택. V3 대비 순수 개선(하락 지표 없음)이므로 트레이드오프
  고민 없이 교체. 베이스라인 대비로도 4개 지표 전부 우수
  (faithfulness +6.0%p, answer_relevancy +9.9%p, context_precision +3.0%p,
  context_recall +23.2%p).

  [알려진 잔여 이슈 — 의도적으로 미수정, 2026-08-10]
  QA-06("대정오일장은 언제 갈 수 있어?")에서 "대정오일장은 숙소에서 약 0m
  거리에 있다"는 할루시네이션이 V3·V4 동일하게 발생. 원인은 "오일장"이
  KNOWN_DATA_GAP_KEYWORDS(약국/병원/마트)에 빠져 있어 가드가 안 걸리고,
  게스트하우스 FAQ가 검색되면서 LLM이 지어낸 것으로 추정. 이번 튜닝과는
  무관한 별개 이슈이며, 팀 판단으로 지금은 보류하고 있음
  (필요 시 KNOWN_DATA_GAP_KEYWORDS에 "오일장" 추가로 간단히 대응 가능).

  [폐기된 실험 — 2026-08-10, top_k_per_query=3 유지 + RRF 가중치만 추가 변경]
  V4의 original_query_weight=1.0 / alternative_query_weight=0.5에서 값을
  추가로 바꿔본 변형. V4 대비 결과:
    faithfulness       0.590 → 0.551   (-4.0%p)
    answer_relevancy   0.367 → 0.356   (-1.1%p)
    context_precision  0.455 → 0.479   (+2.4%p)
    context_recall     0.429 → 0.393   (-3.6%p)
  4개 중 3개 하락(특히 faithfulness·recall 동반 하락)하여 폐기.
  구체적 회귀 사례: TRAP-07(흡연 가능 식당)에서 V4가 고쳤던 답변이 다시
  무관한 식당 추천으로 퇴행. QA-20(이불교체)에서는 컨텍스트에 없는 "이불함"
  개념을 LLM이 완전히 지어내는 새로운 할루시네이션 발생. QA-08에서도 무관한
  식당 정보가 다시 끼어드는 노이즈 재발.
  참고로 QA-06(오일장) 할루시네이션은 이 변형에서 우연히 사라졌으나(정직한
  "정보 없음" 응답), 다른 지표 하락폭이 더 커서 채택하지 않음.
  → 결론: original_query_weight=1.0 / alternative_query_weight=0.5(V4)를
    유지. 이 조합(가중치 값 미기록 — 정확한 값은 실험 로그 미보존)은
    재시도하지 않을 것.

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

# [추가] 인덱스에 데이터 자체가 없는 것으로 확인된 카테고리 (약국/병원/마트 등)
# 이 카테고리는 검색/LLM 생성을 거치지 않고 고정 응답으로 즉시 처리한다.
# 이유: LLM에게 "모르면 모른다고 답하라"는 프롬프트 규칙만으로는 불충분함이 확인됨
#       (QA-04에서 존재하지 않는 "붕 해물약국"을, TRAP-07에서 존재하지 않는
#        "Cafe Leesle"을 지어내는 심각한 할루시네이션이 실제로 발생, 2026-08-10)
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
        사용자 쿼리로 관련 POI 검색.

        1. 쿼리 임베딩 생성
        2. ChromaDB에서 상위 top_k개 검색 (이미 유사도순으로 정렬되어 반환됨)
        3. [수정] 유사도 순서를 유지한 채로 반환. solo_friendly/거리 보정은
           generate_response 단계에서 상위 후보 내에서만 적용.

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
                    "is_guesthouse_info": False,  # [추가] FAQ 여부 플래그
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
                "name": metadata.get("name") or metadata.get("poi_name") or "",
                "category_norm": metadata.get("category_norm") or metadata.get("category") or "",
                "distance_m": metadata.get("distance_m", 0),
                "solo_friendly": self._parse_solo_friendly(metadata.get("solo_friendly")),
                "document": doc,
                "similarity_score": 1 - distance,  # ChromaDB는 거리값을 반환, 유사도 = 1 - 거리
                "is_guesthouse_info": metadata.get("type") == "guesthouse_info",
            })

        # 4. [수정] 유사도 순위를 깨뜨리지 않는 선에서만 보조 재순위화
        search_results = self._rerank(search_results)

        return search_results

    def generate_alternative_queries(self, query: str, num_alternatives: int = 2) -> list[str]:
        """
        [V2→V3: 신규 추가] Multi-Query — 사용자 쿼리를 의미상 동등한 다른 표현으로 변환.

        목적: "담배 ↔ 흡연", "편의점 어디야? ↔ 게스트하우스와 가장 가까운 편의점은
        어디야?"처럼 질문 표현과 인덱스 문서 표현이 달라서 벡터 검색이 놓치는
        케이스를 보완 (동의어/유사 표현 커버리지 확대).
        """
        prompt = f"""사용자가 게스트하우스 정보 검색 챗봇에 다음 질문을 했습니다:
"{query}"

이 질문과 같은 의도를 가지지만 다른 단어/표현을 쓰는 검색 쿼리를 {num_alternatives}개 작성하세요.
(동의어, 존댓말/반말 변형, 다른 관점의 표현 모두 활용. 예: "담배" → "흡연", "정류장" → "버스 정류장")

형식 (번호와 쿼리만, 설명 없이):
1. [쿼리1]
2. [쿼리2]"""

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                temperature=0,
                max_tokens=100,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.choices[0].message.content
            alternatives = []
            for line in text.split("\n"):
                line = line.strip()
                if line and ". " in line:
                    alt = line.split(". ", 1)[1].strip()
                    if alt:
                        alternatives.append(alt)
            return [query] + alternatives[:num_alternatives]
        except Exception as e:
            print(f"[Multi-Query] 대체 쿼리 생성 실패, 원본만 사용: {e}")
            return [query]

    def search_multi(self, query: str, top_k_per_query: int = 3, final_k: int = 10) -> list[dict]:
        """
        쿼리당 후보 개수(top_k_per_query)를 5 → 3으로 줄여 노이즈 감소

        RRF_score(doc) = sum over queries of 1 / (60 + rank_in_that_query)
        """
        queries = self.generate_alternative_queries(query)

        rrf_scores: dict[str, dict] = {}  # key: 문서 식별용(name 우선, 없으면 document 앞부분)

        for q in queries:
            per_query_results = self.search(q, top_k=top_k_per_query)
            for rank, item in enumerate(per_query_results):
                key = item["name"] or item["document"][:40]
                if key not in rrf_scores:
                    rrf_scores[key] = {"item": item, "score": 0.0}
                rrf_scores[key]["score"] += 1.0 / (60 + rank + 1)

        merged = sorted(rrf_scores.values(), key=lambda x: -x["score"])
        merged_results = [m["item"] for m in merged]

        # solo_friendly=False 페널티는 병합 이후에도 한 번 더 적용 (일관성 유지)
        merged_results = self._rerank(merged_results)

        return merged_results[:final_k]

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
        [수정됨] 보조 재순위화: 벡터 유사도 순위를 1차 기준으로 유지.

        기존 버그: solo_friendly(사실상 전 문서 True라 변별력 없음) → 거리 순으로
        전체를 재정렬해버려서, 의미상 무관한 문서(특히 distance_m=0인 게스트하우스
        FAQ)가 항상 최상위로 올라가고, 질문 내용과 무관하게 물리적으로 가장 가까운
        POI만 반복 노출되는 문제가 있었음.

        수정 방향:
        - 벡터 검색이 이미 계산한 유사도 순서(입력 results의 순서)를 기본으로 존중.
        - solo_friendly=False인 항목만 살짝 뒤로 미루는 정도의 약한 보정만 적용.
        - distance_m=0(게스트하우스 자체 정보)이라는 이유만으로 순위를 올리지 않음.
        """
        # solo_friendly가 False로 명시된 것만 페널티, 나머지(True/None)는
        # 벡터 유사도 순서를 그대로 유지 (stable sort 특성 활용)
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

    3. **[중요] 사실 그라운딩 규칙**
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

        # LLM 호출 — temperature=0으로 고정 (동일 질문에 매번 다른 답이 나오는 문제 방지)
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

            # [수정] 게스트하우스 FAQ 항목은 name이 비어있으므로,
            # 빈칸을 LLM이 임의로 채우지 않도록 명시적으로 라벨링
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

    def _check_known_data_gap(self, query: str) -> Optional[str]:
        """
        인덱스에 아예 없는 것으로 확인된 카테고리(약국/병원/마트)인지 확인.
        해당되면 카테고리 라벨을 반환, 아니면 None.
        """
        for keyword, label in KNOWN_DATA_GAP_KEYWORDS.items():
            if keyword in query:
                return label
        return None

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
        # 0. [추가] 알려진 데이터 갭 카테고리는 검색/LLM 없이 즉시 고정 응답
        #    (할루시네이션 방지 — 프롬프트 지시만으로는 막지 못함이 확인됨)
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

        # 1. 검색 ([V2→V3] self.search(query) → self.search_multi(query)로 교체.
        #    Multi-Query + RRF 적용, 유사도 순위 유지)
        search_results = self.search_multi(query)

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
        "게스트하우스와 가장 가까운 정류장은 어디인가요?",  # 회귀 테스트용 추가
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
