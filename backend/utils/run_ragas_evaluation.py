"""
RAGAS 평가 실행 스크립트 (0.2+ 스키마)
8월 10일 Phase 3: 28개 질문으로 RAG 평가

실행: python backend/utils/run_ragas_evaluation.py

출력:
  - data/eval/eval_results.json (평가 결과)
  - Console 출력 (실시간 진행상황)
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from unittest.mock import MagicMock

# --- [버그 패치] Ragas 라이브러리의 불필요한 VertexAI 임포트 에러 우회 ---
if 'langchain_community.chat_models.vertexai' not in sys.modules:
    sys.modules['langchain_community.chat_models.vertexai'] = MagicMock()
# -----------------------------------------------------------------------

# 프로젝트 루트를 찾기
current_file = Path(__file__).resolve()
project_root = current_file.parent.parent.parent
sys.path.insert(0, str(project_root))
os.chdir(project_root)

print("=" * 80)
print("RAGAS 평가 실행 (0.2+ 스키마)")
print("=" * 80)
print(f"프로젝트 루트: {project_root}")

# ============================================================================
# 1️⃣ 골드셋 로드
# ============================================================================
print("\n[1/5] 골드셋 로드 중...\n")

try:
    gold_qa_path = "data/eval/gold_qa.json"
    trap_questions_path = "data/eval/trap_questions.json"
    
    with open(gold_qa_path, 'r', encoding='utf-8') as f:
        gold_qa = json.load(f)
    
    with open(trap_questions_path, 'r', encoding='utf-8') as f:
        trap_questions = json.load(f)
    
    print(f"✓ 정보 QA 로드: {len(gold_qa)}건")
    print(f"✓ 함정 질문 로드: {len(trap_questions)}건")
    print(f"✓ 총 평가 셋: {len(gold_qa) + len(trap_questions)}건")
    
except Exception as e:
    print(f"✗ 골드셋 로드 실패: {e}")
    sys.exit(1)

# ============================================================================
# 2️⃣ RAG 서비스 초기화
# ============================================================================
print("\n[2/5] RAG 서비스 초기화 중...\n")

try:
    from backend.services.rag_service import RAGService
    
    service = RAGService()
    print("✓ RAGService 초기화 완료")
    
except Exception as e:
    print(f"✗ RAG 서비스 초기화 실패: {e}")
    sys.exit(1)

# ============================================================================
# 3️⃣ RAG 응답 생성 (모든 질문에 대해)
# ============================================================================
print("\n[3/5] RAG 응답 생성 중... (이 과정이 가장 오래 걸립니다)\n")

all_questions = gold_qa + trap_questions
evaluation_data = {
    "user_input": [],
    "retrieved_contexts": [],
    "response": [],
    "reference": [],
    "id": []
}

for idx, qa in enumerate(all_questions, 1):
    question = qa['question']
    expected_answer = qa['expected_answer']
    gold_context = qa.get('gold_context', [])
    
    # 프로그레스 표시
    print(f"  [{idx}/{len(all_questions)}] {qa['id']}: {question[:50]}...", end=" ", flush=True)
    
    try:
        # RAG 응답 생성
        result = service.answer_query(question)
        rag_answer = result.get('response', '')
        rag_search_results = result.get('search_results', [])
        
        # RAGAS 0.2+ 스키마로 변환
        contexts = [poi['document'] for poi in rag_search_results] if rag_search_results else []
        
        evaluation_data["user_input"].append(question)
        evaluation_data["retrieved_contexts"].append(contexts)
        evaluation_data["response"].append(rag_answer)
        evaluation_data["reference"].append(expected_answer)
        evaluation_data["id"].append(qa['id'])
        
        print("✓")
        
    except Exception as e:
        print(f"✗ ({e})")
        evaluation_data["user_input"].append(question)
        evaluation_data["retrieved_contexts"].append([])
        evaluation_data["response"].append(f"[오류: {str(e)}]")
        evaluation_data["reference"].append(expected_answer)
        evaluation_data["id"].append(qa['id'])

print(f"\n✓ RAG 응답 생성 완료: {len(evaluation_data['user_input'])}건")

# ============================================================================
# 4️⃣ RAGAS 평가 실행 (0.2+ 스키마)
# ============================================================================
print("\n[4/5] RAGAS 평가 실행 중...\n")

try:
    from ragas.evaluation import evaluate
    from ragas.metrics import (
        faithfulness,
        answer_relevancy,
        context_recall,
        context_precision,
    )
    from datasets import Dataset
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    
    # 평가용 LLM과 임베딩 설정
    print("  LLM 및 임베딩 모델 초기화 중...")
    evaluator_llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)
    evaluator_embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    
    # Dataset 객체 생성
    print("  평가 데이터셋 생성 중...")
    eval_dataset = Dataset.from_dict(evaluation_data)
    
    # RAGAS 평가 실행
    print("  RAGAS 평가 실행 중... (이 단계가 5-10분 소요됩니다)")
    eval_results = evaluate(
        dataset=eval_dataset,
        metrics=[
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
        ],
        llm=evaluator_llm,
        embeddings=evaluator_embeddings,
        raise_exceptions=False  # API 에러 발생 시 중단하지 않음
    )
    
    print("✓ RAGAS 평가 완료")
    
    # 리스트 형태의 결과값에 대한 안전한 평균 계산 기능 지원
    def get_mean(metric_data):
        if isinstance(metric_data, list) and len(metric_data) > 0:
            return sum(metric_data) / len(metric_data)
        elif isinstance(metric_data, (int, float)):
            return float(metric_data)
        return 0.0
    
    # 결과를 딕셔너리로 변환 (EvaluationResult 객체 맞춤형 인덱싱 적용)
    results_dict = {
        "faithfulness": get_mean(eval_results["faithfulness"]),
        "answer_relevancy": get_mean(eval_results["answer_relevancy"]),
        "context_precision": get_mean(eval_results["context_precision"]),
        "context_recall": get_mean(eval_results["context_recall"]),
    }
    
except Exception as e:
    print(f"⚠️ RAGAS 평가 실패: {e}")
    import traceback
    traceback.print_exc()
    results_dict = None

# ============================================================================
# 5️⃣ 결과 저장 및 출력
# ============================================================================
print("\n[5/5] 결과 저장 중...\n")
print("\n[5/5] 결과 저장 중...\n")
 
try:
    # 가독성 극대화를 위한 데이터 구조 재배열 (행 기반 객체 리스트)
    formatted_dataset = []
    for i in range(len(evaluation_data["id"])):
        formatted_dataset.append({
            "id": evaluation_data["id"][i],
            "question": evaluation_data["user_input"][i],
            "expected_answer": evaluation_data["reference"][i],
            "rag_response": evaluation_data["response"][i],
            "retrieved_contexts": evaluation_data["retrieved_contexts"][i]
        })

    # 상세 결과 저장
    detailed_results = {
        "timestamp": datetime.now().isoformat(),
        "total_questions": len(evaluation_data["user_input"]),
        "evaluation_dataset": formatted_dataset, # 재배열된 데이터 적용
        "ragas_results": results_dict if results_dict else "RAGAS 평가 실패",
        "summary": {
            "total_count": len(evaluation_data["user_input"]),
            "qa_count": len(gold_qa),
            "trap_count": len(trap_questions)
        }
    }
    
    with open('data/eval/eval_results_detailed.json', 'w', encoding='utf-8') as f:
        json.dump(detailed_results, f, ensure_ascii=False, indent=2)
    
    print("✓ 상세 결과 저장: data/eval/eval_results_detailed.json")
    
    # 요약 결과 저장
    if results_dict:
        summary_results = {
            "timestamp": datetime.now().isoformat(),
            "metrics": results_dict,
            "total_questions": len(evaluation_data["user_input"]),
            "qa_count": len(gold_qa),
            "trap_count": len(trap_questions)
        }
    else:
        summary_results = {
            "timestamp": datetime.now().isoformat(),
            "status": "RAGAS 평가 실패 - 수동 분석 필요",
            "total_questions": len(evaluation_data["user_input"]),
            "qa_count": len(gold_qa),
            "trap_count": len(trap_questions)
        }
    
    with open('data/eval/eval_results.json', 'w', encoding='utf-8') as f:
        json.dump(summary_results, f, ensure_ascii=False, indent=2)
    
    print("✓ 요약 결과 저장: data/eval/eval_results.json")
    
except Exception as e:
    print(f"✗ 결과 저장 실패: {e}")
    sys.exit(1)

# ============================================================================
# 최종 출력
# ============================================================================
print("\n" + "=" * 80)
print("✓ RAGAS 평가 완료!")
print("=" * 80)
 
print("\n📊 평가 결과 요약:\n")
print(f"  • 총 평가 질문: {len(evaluation_data['user_input'])}개")
print(f"    - 정보 QA: {len(gold_qa)}개")
print(f"    - 함정 질문: {len(trap_questions)}개")
 
if results_dict:
    print(f"\n  • Answer Relevance: {results_dict.get('answer_relevancy', 'N/A')}")
    print(f"  • Faithfulness: {results_dict.get('faithfulness', 'N/A')}")
else:
    print(f"\n  ⚠️ RAGAS 메트릭 계산 실패")
    print(f"     상세 결과는 data/eval/eval_results_detailed.json 에서 확인 가능")
 
print(f"\n📁 저장 위치:")
print(f"  • 요약 결과: data/eval/eval_results.json")
print(f"  • 상세 결과: data/eval/eval_results_detailed.json")
 
print("\n" + "=" * 80)
