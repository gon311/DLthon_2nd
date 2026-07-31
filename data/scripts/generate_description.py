"""
POI description 생성 및 1인 적합도 판단 스크립트.

입력: guesthouse_pois.csv (description이 비어있음)
처리: LLM으로 각 POI의 description 생성 + solo_friendly 판단
출력: description, solo_friendly 필드가 추가된 CSV

사용법:
    python data/scripts/generate_description.py
"""

import csv
import json
import os
from pathlib import Path

from openai import OpenAI

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]


def generate_description_and_solo_score(client: OpenAI, name: str, category: str) -> dict:
    """
    LLM으로 POI description 생성 및 1인 적합도 판단.
    
    Returns:
        {
            "description": "짧은 설명",
            "solo_friendly": True/False/None  (True: 적합, False: 부적합, None: 중립)
        }
    """
    prompt = f"""다음 관광지/시설에 대해 답변해주세요:

상호명: {name}
카테고리: {category}

1. 한 문장 설명 (20~50자): 이 장소의 특징을 간결하게 설명해주세요.
2. 1인 이용 적합도: "적합" / "부적합" / "중립" 중 선택하세요.
   판단 기준:
   - 음식점: 1인 식사 가능한 좌석/메뉴가 있다면 "적합", 없다면 "부적합", 불명확하면 "중립"
   - 관광지/문화시설: 개인 관광이 가능하다면 "적합", 단체/예약 필수라면 "부적합", 불명확하면 "중립"
   - 편의점/주차장: 기본적으로 "적합" (1인 이용이 자명함. 요트투어/서비스 예약용이라도 "적합" 처리)

응답 형식 (JSON):
{{
  "description": "...",
  "solo_friendly": "적합" 또는 "부적합" 또는 "중립"
}}
"""

    try:
        # v1.3.0 호환 레거시 API
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.choices[0].message.content
        # JSON 추출 (```json ... ``` 형식일 수 있음)
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        data = json.loads(text.strip())

        # solo_friendly를 boolean으로 변환
        solo_map = {"적합": True, "부적합": False, "중립": None}
        solo_friendly = solo_map.get(data.get("solo_friendly"), None)

        return {
            "description": data.get("description", ""),
            "solo_friendly": solo_friendly,
        }
    except Exception as e:
        print(f"  ⚠️ {name}: {e}")
        return {"description": "", "solo_friendly": None}


def main():
    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY 환경변수가 필요합니다.")

    csv_path = Path("data/processed/guesthouse_pois.csv")
    if not csv_path.exists():
        raise SystemExit(f"{csv_path}를 찾을 수 없습니다.")

    client = OpenAI()

    # CSV 읽기
    rows = []
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"처리할 POI: {len(rows)}건\n")

    # 각 POI에 대해 description 생성
    for idx, row in enumerate(rows, 1):
        name = row.get("name", "")
        category = row.get("category_raw", "")

        print(f"[{idx}/{len(rows)}] {name} ({category})...", end=" ", flush=True)

        result = generate_description_and_solo_score(client, name, category)

        row["description"] = result["description"]
        row["solo_friendly"] = (
            "True" if result["solo_friendly"] is True else
            "False" if result["solo_friendly"] is False else
            ""
        )

        print(f"✓ ({result['solo_friendly']})")

    # CSV 저장
    if rows:
        fieldnames = list(rows[0].keys())
        # solo_friendly 필드가 없으면 추가
        if "solo_friendly" not in fieldnames:
            fieldnames.append("solo_friendly")

        with open(csv_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        print(f"\n✅ 완료: {csv_path}")
        print(f"   - description 생성: {len([r for r in rows if r.get('description')])}건")
        print(
            f"   - solo_friendly 판단: {len([r for r in rows if r.get('solo_friendly')])}건"
        )


if __name__ == "__main__":
    main()