-- readings 민감 컬럼 암호화 (Supabase Vault + pgcrypto)
-- 대상 컬럼: question_text, reading_content, synthesis, cards
-- 키는 vault.secrets('readings_enc_key')에만 존재. 코드/테이블에 평문 키 없음.
-- 본인만 호출 가능한 SECURITY DEFINER RPC 2개로 입·출력을 좁힌다.
--
-- 실행 위치: Supabase Dashboard > SQL Editor (한 번만)
-- 사전 합의: 기존 readings 데이터는 폐기(TRUNCATE)한다.

-- ─── 1) 확장 ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
-- vault 스키마는 Supabase Hosted에서 기본 제공된다.

-- ─── 2) Vault에 대칭키 등록 (없을 때만, 32바이트 랜덤 base64) ──
DO $$
DECLARE
  v_key_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'readings_enc_key') THEN
    SELECT vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'readings_enc_key',
      'pgcrypto sym key for readings; do not export'
    ) INTO v_key_id;
  END IF;
END $$;

-- ─── 3) 평문 폐기 후 컬럼 교체 ─────────────────────────────────
TRUNCATE TABLE public.readings;

ALTER TABLE public.readings
  DROP COLUMN IF EXISTS question_text,
  DROP COLUMN IF EXISTS reading_content,
  DROP COLUMN IF EXISTS synthesis,
  DROP COLUMN IF EXISTS cards;

ALTER TABLE public.readings
  ADD COLUMN question_text_enc   bytea NOT NULL,
  ADD COLUMN reading_content_enc bytea NOT NULL,
  ADD COLUMN synthesis_enc       bytea NULL,
  ADD COLUMN cards_enc           bytea NOT NULL;

-- ─── 4) INSERT RPC ────────────────────────────────────────────
-- user_id는 auth.uid()로 강제. 키는 내부에서 vault에서 읽고 호출자에게 노출 X.
CREATE OR REPLACE FUNCTION public.insert_reading(
  p_question_text   text,
  p_reading_type    text,
  p_cards           jsonb,
  p_reading_content text,
  p_synthesis       text,
  p_session_id      text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text;
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'readings_enc_key'
    LIMIT 1;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'KEY_MISSING';
  END IF;

  INSERT INTO public.readings (
    user_id, reading_type, session_id,
    question_text_enc, reading_content_enc, synthesis_enc, cards_enc
  ) VALUES (
    v_uid, p_reading_type, p_session_id,
    extensions.pgp_sym_encrypt(coalesce(p_question_text, ''),   v_key),
    extensions.pgp_sym_encrypt(coalesce(p_reading_content, ''), v_key),
    CASE WHEN p_synthesis IS NULL THEN NULL
         ELSE extensions.pgp_sym_encrypt(p_synthesis, v_key) END,
    extensions.pgp_sym_encrypt(coalesce(p_cards, '[]'::jsonb)::text, v_key)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.insert_reading(text, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_reading(text, text, jsonb, text, text, text) TO authenticated;

-- ─── 5) SELECT RPC ────────────────────────────────────────────
-- 본인 행만 복호화. p_limit 만큼 created_at DESC로 반환.
-- bag은 200건을 받아 클라이언트에서 reverse(ASC)하여 세션 그룹화에 사용.
CREATE OR REPLACE FUNCTION public.get_my_readings(p_limit int DEFAULT 200)
RETURNS TABLE (
  id              uuid,
  created_at      timestamptz,
  question_text   text,
  reading_type    text,
  reading_content text,
  synthesis       text,
  cards           jsonb,
  session_id      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'readings_enc_key'
    LIMIT 1;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'KEY_MISSING';
  END IF;

  RETURN QUERY
    SELECT
      r.id,
      r.created_at,
      extensions.pgp_sym_decrypt(r.question_text_enc, v_key)            AS question_text,
      r.reading_type,
      extensions.pgp_sym_decrypt(r.reading_content_enc, v_key)          AS reading_content,
      CASE WHEN r.synthesis_enc IS NULL THEN NULL
           ELSE extensions.pgp_sym_decrypt(r.synthesis_enc, v_key) END  AS synthesis,
      extensions.pgp_sym_decrypt(r.cards_enc, v_key)::jsonb             AS cards,
      r.session_id
    FROM public.readings r
    WHERE r.user_id = v_uid
    ORDER BY r.created_at DESC
    LIMIT GREATEST(coalesce(p_limit, 200), 0);
END
$$;

REVOKE ALL ON FUNCTION public.get_my_readings(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_readings(int) TO authenticated;

-- ─── 6) RLS는 기존 정책(auth.uid() = user_id)을 그대로 유지 ──
-- DELETE는 bag/route.ts에서 RLS 통해 직접 수행한다 (평문 컬럼 미사용).
-- SELECT 정책도 유지 — 다만 RPC가 SECURITY DEFINER이므로 함수 경로로는
-- 정책을 우회하지만, 함수 내부에서 user_id = auth.uid()로 직접 필터한다.
