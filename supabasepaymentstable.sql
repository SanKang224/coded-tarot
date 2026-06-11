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
  expires_at   timestamptz NOT NULL       -- created_at + 3년. 마이페이지 영수증을 최근 3년만 '표시'하는 필터용 (삭제 아님)
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
-- ⚠ 결제 기록 자동 삭제 금지 (전자상거래법)
-- ------------------------------------------------------------
-- 결제·대금결제 기록은 관계 법령상 5년 보존 의무가 있다.
-- expires_at(3년)을 기준으로 payments 행을 DELETE 하는 잡을 절대 만들지 마라 — 법 위반이다.
-- expires_at 은 마이페이지에 최근 3년 영수증만 '표시'하기 위한 필터일 뿐, 삭제 트리거가 아니다.
--
-- 보존기간(탈퇴 후 5년) 만료 시 탈퇴회원 데이터 파기는 아래 마이그레이션이 담당한다:
--   supabase/migrations/20260611_retention_purge_cron.sql
-- ============================================================
