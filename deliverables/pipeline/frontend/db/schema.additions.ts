// ============================================================================
// 이용자 참여형 지식 파이프라인 — DB 스키마 추가분
// frontend/db/schema.ts 하단에 아래 두 테이블을 붙여넣고, `real` import를 추가하세요.
//   import { integer, real, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
// ============================================================================
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

/** AI 질문 탭에서 들어온 질의 로그 (데이터 선순환의 입력) */
export const queryLogs = sqliteTable(
  "query_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull(),          // 익명 세션 식별자(비식별)
    question: text("question").notNull(),             // 질문(비식별화 후 저장)
    answered: integer("answered", { mode: "boolean" }).notNull().default(false),
    confidence: real("confidence"),                   // RAG 신뢰도 0~1 (없으면 null)
    retrievedIds: text("retrieved_ids"),              // 검색된 문서 id 목록(JSON 문자열)
    answerPreview: text("answer_preview"),            // 답변 미리보기(비식별화, 선택)
    fallback: integer("fallback", { mode: "boolean" }).notNull().default(false), // "정보 없음" 폴백 여부
    feedback: text("feedback"),                       // helpful | not_helpful | null
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("idx_query_logs_created").on(t.createdAt), index("idx_query_logs_answered").on(t.answered)],
);

/** 이용자가 제안한 추가·변경 정보 (검수 후 지식 스키마에 반영) */
export const knowledgeSubmissions = sqliteTable(
  "knowledge_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    submitterId: text("submitter_id"),                // 로그인 사용자 id 또는 null(익명)
    targetName: text("target_name").notNull(),        // 장소/항목명 (예: "대정쌍둥이식당")
    category: text("category"),                        // 음식점 / 편의시설 / 숙소FAQ 등
    content: text("content").notNull(),               // 추가·변경 내용 (예: "영업시간 11:00~21:00")
    sourceHint: text("source_hint"),                  // 근거(선택)
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    reviewedBy: text("reviewed_by"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("idx_knowledge_submissions_status").on(t.status)],
);
