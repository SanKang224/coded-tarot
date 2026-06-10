# CODED TAROT — 운영 매뉴얼 (수동 작업 RUNBOOK)

앱에서 자동 처리되지 않고 **운영자가 직접 해야 하는** 작업 모음.
대부분 Supabase Dashboard(SQL Editor) 또는 Vercel(환경변수)에서 한다.

---

## 0. 환경변수 (Vercel → Settings → Environment Variables)

| 변수 | 용도 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 공개 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 | 공개 |
| `SUPABASE_SERVICE_ROLE_KEY` | 탈퇴/관리 admin 작업 | **비밀 · NEXT_PUBLIC 금지** |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 토스 결제 위젯 | 공개 |
| `TOSS_SECRET_KEY` | 토스 결제 승인(서버) | **비밀** |
| `GEMINI_API_KEY` | 리딩 생성 LLM | **비밀** |
| `PROMO_CODE_<코드>` | 프로모 코드별 지급 토큰 수 | 아래 3번 참고 |
| `NEXT_PUBLIC_NOINDEX` | 검색 비노출 토글 | 선택 |

> 키 추가/변경 후 **재배포**해야 적용된다.

---

## 1. 관리자(admin) 지정

`profiles.is_admin = true` 인 계정은 토큰 무제한·프로모 무제한 등 권한을 가진다. 코드로는 설정 못 하고 **수동**이다.

```sql
-- 이메일로 대상 찾아 관리자 지정
UPDATE public.profiles
SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = '관리자@이메일.com');

-- 해제
UPDATE public.profiles SET is_admin = false
WHERE id = (SELECT id FROM auth.users WHERE email = '관리자@이메일.com');