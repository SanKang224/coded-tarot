# CODED TAROT — 운영 매뉴얼 (수동 작업 RUNBOOK)

앱에서 자동 처리되지 않고 운영자가 직접 해야 하는 작업 모음.
대부분 Supabase Dashboard(SQL Editor) 또는 Vercel(환경변수)에서 한다.

## 0. 환경변수 (Vercel)
| 변수 | 용도 | 비고 |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL / ANON_KEY | Supabase 연결 | 공개 |
| SUPABASE_SERVICE_ROLE_KEY | 탈퇴/관리 admin | 비밀·NEXT_PUBLIC 금지 |
| NEXT_PUBLIC_TOSS_CLIENT_KEY | 결제 위젯 | 공개 |
| TOSS_SECRET_KEY | 결제 승인(서버) | 비밀 |
| GEMINI_API_KEY | 리딩 생성 | 비밀 |
| PROMO_CODE_<코드> | 프로모 코드별 지급 토큰 수 | 3번 참고 |
> 키 변경 후 Redeploy 필요. 노출 시 즉시 재발급.

## 1. 관리자 지정
UPDATE public.profiles SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = '관리자@이메일.com');

## 2. 공지사항 작성/관리 (앱은 읽기 전용)
INSERT INTO public.notices (kind, title, body, pinned)
VALUES ('update', '제목', '본문(줄바꿈은 따옴표 안 엔터)', true);
-- 내리기: UPDATE notices SET is_active=false WHERE id='...';
-- kind는 'update'|'event' 소문자만. id/published_at은 비워두면 자동.

## 3. 프로모 코드 발급
Vercel에 PROMO_CODE_WELCOME=5 추가 → 재배포. 사용자 `/code WELCOME`.
코드당 100명·1인 1회(code_redemptions). 관리자 무제한. 중단=환경변수 삭제.

## 4. 회원 탈퇴 복구(되살리기) — 새 계정 만들지 말 것
SELECT u.id, i.identity_data->>'email' FROM auth.users u
  JOIN auth.identities i ON i.user_id=u.id
  WHERE i.identity_data->>'email'='문의자@이메일.com';
UPDATE auth.users SET banned_until=NULL WHERE id='대상-uuid';
UPDATE public.profiles SET deleted_at=NULL, deleted_reason=NULL WHERE id='대상-uuid';
DELETE FROM public.withdrawn_members WHERE user_id='대상-uuid';
-- 본인확인 후 수동. 결제 이력 있으면 hard delete 금지(법정 보존).

## 5. 결제 환불 (청약철회정책 기준 수동)
help@ 신청 → payments에서 주문·토큰 사용여부 확인 → 토스 대시보드 취소 → token_balance 보정.
7일내 미사용=전액 / 일부사용=정상가+위약금10% 공제 / 7일경과·전부사용=불가.

## 6. DB 마이그레이션
supabase/migrations/*.sql 은 자동 실행 안 됨 → SQL Editor에 붙여 1회 실행.

## 7. 약관/방침 개정
legalDocs.ts 수정 → LEGAL_VERSIONS 시행일 + 부칙 갱신 → 다음 로그인에 자동 재동의 게이트.

## 8. 문제 계정 정리
프로필만 깨진 테스트 계정 → Authentication → Users에서 Delete.
결제 이력 있는 계정은 절대 hard delete 금지 → 소프트 탈퇴만.

## 9. 보존기간 만료 데이터 자동 파기 (pg_cron)
탈퇴 회원의 분리보관 데이터(payments·user_consents·withdrawn_members)를
탈퇴 후 5년 경과 시 자동 파기. 비식별·차단된 auth.users / profiles 행은 영구차단 유지 위해 남긴다.
- 설치: supabase/migrations/20260611_retention_purge_cron.sql 을 SQL Editor에 1회 실행(6번 참고). pg_cron 확장 필요.
- 스케줄: 매월 1일 18:00 UTC(=03:00 KST). 향후 3~5년 뒤부터 실제 삭제 발생.
- 수동 점검(대상 없으면 0): SELECT public.purge_expired_withdrawn_members();
- 실행 이력: cron.job_run_details (jobname='purge-expired-withdrawn-members').
- 중지: SELECT cron.unschedule('purge-expired-withdrawn-members');