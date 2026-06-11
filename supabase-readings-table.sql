-- ============================================================
-- CODED TAROT — readings 테이블 생성
-- Supabase 대시보드 > SQL Editor 에서 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS public.readings (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  question_text text NOT NULL,
  reading_type  text NOT NULL,  -- 'QUESTION' | 'FLOW' | 'TIMING'
  cards         jsonb NOT NULL DEFAULT '[]',
  -- [{ positionName, cardNameKo, cardNum, isReversed, reading }]
  reading_content text NOT NULL DEFAULT '',
  synthesis     text
);

-- RLS 활성화
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 읽기/쓰기
CREATE POLICY "readings_select_own" ON public.readings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "readings_insert_own" ON public.readings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICYㅁ"readings_delete_own" ON public.readings
  FOR DELETE USING (auth.uid() = user_id);

-- 최근 10건 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS readings_user_created
  ON public.readings (user_id, created_at DESC);
