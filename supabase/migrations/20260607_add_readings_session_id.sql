-- 질문 내역을 스프레드(세션) 단위로 묶기 위한 session_id 추가
-- 한 스프레드의 최초질문 + 꼬리질문들이 같은 session_id를 공유한다.
-- Supabase Dashboard > SQL Editor 에서 실행하라.

ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_readings_session_id
  ON readings (session_id)
  WHERE session_id IS NOT NULL;
