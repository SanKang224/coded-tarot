-- 분쟁 대비 동의 이력 (append-only 감사 로그)
-- 기록 대상:
--   회원가입 필수 동의 — age_14 / terms / privacy  (context='signup')
--   결제 시 청약철회 동의 — refund_policy            (context='payment', order_id 연결)
--
-- 실행 위치: Supabase Dashboard > SQL Editor (한 번만)

CREATE TABLE IF NOT EXISTS public.user_consents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type   text NOT NULL CHECK (consent_type IN ('age_14','terms','privacy','refund_policy')),
  policy_version text NOT NULL,
  context        text NOT NULL CHECK (context IN ('signup','payment')),
  order_id       text,        -- 결제 동의일 때 toss_order_id 연결
  user_agent     text,        -- 가입 동의 시 클라이언트 UA (참고용)
  agreed_at      timestamptz NOT NULL DEFAULT now(),  -- 이용자가 실제 동의한 시점
  created_at     timestamptz NOT NULL DEFAULT now()   -- DB 기록 시점
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user
  ON public.user_consents (user_id, consent_type);

CREATE INDEX IF NOT EXISTS idx_user_consents_order
  ON public.user_consents (order_id)
  WHERE order_id IS NOT NULL;

-- RLS: 본인 행만 조회/삽입. 수정·삭제는 막아 감사 로그의 무결성을 보장.
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_consents_select_own" ON public.user_consents;
CREATE POLICY "user_consents_select_own" ON public.user_consents
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_consents_insert_own" ON public.user_consents;
CREATE POLICY "user_consents_insert_own" ON public.user_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
