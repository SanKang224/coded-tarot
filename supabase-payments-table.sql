-- ============================================================
-- CODED TAROT — payments 테이블 생성
-- Supabase 대시보드 > SQL Editor 에서 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  amount       integer NOT NULL,          -- 결제 금액 (원)
  tokens_added integer NOT NULL,          -- 지급 토큰 수
  package_name text NOT NULL,             -- '소 (3토큰)' | '중 (15토큰)' | '대 (30토큰)'
  payment_key  text,                      -- Toss Payments paymentKey (검증용)
  expires_at   timestamptz NOT NULL       -- insert 시 created_at + 3년으로 계산해서 삽입
);

-- RLS 활성화
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 읽기
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- 서버사이드(service role)에서만 INSERT 허용 — 클라이언트 직접 삽입 차단
-- (INSERT policy 없음 = anon/authenticated role INSERT 불가)

-- 조회 성능 인덱스
CREATE INDEX IF NOT EXISTS payments_user_created
  ON public.payments (user_id, created_at DESC);

-- ============================================================
-- 만료 레코드 자동 삭제 (pg_cron 사용)
-- Supabase Pro 플랜 이상에서 pg_cron 활성화 후 실행
-- ============================================================

-- SELECT cron.schedule(
--   'delete-expired-payments',
--   '0 3 * * *',   -- 매일 새벽 3시
--   $$ DELETE FROM public.payments WHERE expires_at < now(); $$
-- );
