-- Toss Payments 연동을 위한 payments 테이블 컬럼 추가
-- Supabase Dashboard > SQL Editor 에서 실행하라.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS toss_order_id    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS toss_payment_key TEXT;

-- 인덱스: toss_order_id 조회 최적화
CREATE INDEX IF NOT EXISTS idx_payments_toss_order_id
  ON payments (toss_order_id)
  WHERE toss_order_id IS NOT NULL;
