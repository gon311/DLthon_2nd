# 웹데모 AI 질문 탭 ↔ RAG 연결 (Cloudflare Worker 인메모리 RAG)

> ⚠️ **정직한 구분**: 이 Worker RAG는 팀의 `rag_service.py`를 호출하지 않는 **별도의 경량 재구현**입니다.
> 지식 소스(POI CSV + FAQ JSON)와 규칙(고정 응답·폴백·거리 재랭킹)만 동일하게 맞췄고, 코드는 독립적입니다.
> - **라이브 데모**: 배포 안정성을 위해 이 경량 Worker 구현 사용(동일 지식·동일 규칙).
> - **RAGAS 평가 점수**: 오프라인 파이썬 RAG 파이프라인(`rag_service.py`) 기준. 두 구현의 점수를 동일시하지 말 것.

파이썬 백엔드를 따로 띄우지 않고, **작은 지식베이스(POI 21 + 숙소 FAQ 30)**를
Worker 안에서 임베딩+검색+생성으로 처리합니다. 평가한 RAG와 **같은 지식·같은 문서 포맷**을 사용합니다.

## 1) 지식 임베딩 생성 (1회, 데이터 바뀔 때만)
```bash
OPENAI_API_KEY=sk-... node frontend/scripts/build_knowledge_embeddings.mjs
# → frontend/app/api/ask/knowledge_embeddings.json 생성
```

## 2) 배포 시크릿 (Codex/Sites)
- `OPENAI_API_KEY` : OpenAI 키 (임베딩+생성)
- (선택) `SELF_BASE_URL` : 질의 로그를 남길 자기 도메인 (이용자 참여형 파이프라인 연동)
- (선택) 채팅 모델은 `route.ts`의 `CHAT_MODEL`에서 변경

## 3) 프론트 AI 질문 탭 연결 (client-home.tsx)
현재 "자료 준비 중" 플레이스홀더를 아래처럼 실제 호출로 교체:

```ts
const [asking, setAsking] = useState(false);
const [messages, setMessages] = useState<{role:"user"|"assistant"; text:string; sources?:string[]}[]>([]);
const sessionId = useRef(crypto.randomUUID());

async function ask(q: string) {
  setMessages(m => [...m, { role: "user", text: q }]);
  setAsking(true);
  try {
    const r = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q, sessionId: sessionId.current }),
    });
    const data = await r.json();
    setMessages(m => [...m, { role: "assistant", text: data.answer, sources: data.sources }]);
  } finally { setAsking(false); }
}
```
- 입력창 `disabled` 제거, 전송 시 `ask(value)` 호출
- 답변 카드 하단에 `sources`(참고한 장소)와 `👍/👎`(query-logs PATCH) 표시
- 예시 질문 버튼(체크인/근처 맛집 등)도 `ask()`에 연결

## 4) 동작 방식 (평가 버전과 동일 취지)
- 질의 임베딩 → 코사인 상위 6 → 거리 보정 재랭킹 → top-3
- **인덱스에 없는 카테고리(약국·병원·마트 등) → 고정 응답** (환각 방지)
- **근거 유사도 < 0.30 → 폴백** "정보 없음, 프런트 문의" (지어내지 않음)
- 답변은 컨텍스트 근거만 사용하도록 프롬프트로 제약, 참고 출처(sources) 반환

## 5) 데모 체크리스트
- [ ] 임베딩 생성 완료(knowledge_embeddings.json 존재)
- [ ] OPENAI_API_KEY 시크릿 설정 후 재배포
- [ ] "가장 가까운 편의점?", "혼밥할 곳?", "와이파이 비번?" 정상 답변 확인
- [ ] "가장 가까운 약국?" → 고정 응답(거부) 확인
- [ ] **라이브 실패 대비**: 발표 백업으로 'RAG 실제 응답' 슬라이드/녹화 유지

> 주의: 이 Worker RAG는 웹데모 UX용입니다. RAGAS 점수는 PL의 파이썬 RAG(동일 지식·로직)에서 산출됐으며,
> 두 구현의 지식 소스(POI CSV + guesthouse_faq.json)와 규칙(고정 응답·폴백)을 동일하게 유지하세요.
