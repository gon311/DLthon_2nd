-- 이용자 참여형 지식 파이프라인 마이그레이션
CREATE TABLE `query_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_id` text NOT NULL,
  `question` text NOT NULL,
  `answered` integer DEFAULT 0 NOT NULL,
  `confidence` real,
  `retrieved_ids` text,
  `answer_preview` text,
  `fallback` integer DEFAULT 0 NOT NULL,
  `feedback` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX `idx_query_logs_created` ON `query_logs` (`created_at`);
CREATE INDEX `idx_query_logs_answered` ON `query_logs` (`answered`);

CREATE TABLE `knowledge_submissions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `submitter_id` text,
  `target_name` text NOT NULL,
  `category` text,
  `content` text NOT NULL,
  `source_hint` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `reviewed_by` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX `idx_knowledge_submissions_status` ON `knowledge_submissions` (`status`);
