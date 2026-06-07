@AGENTS.md
@./design/tone.md
@./design/forbidden.md
@./design/required.md

# CLAUDE.md — CODED TAROT
LLM 코딩에서 자주 발생하는 실수를 줄이기 위한 행동 가이드라인.
프로젝트별 지시사항과 함께 적용한다.

**Tradeoff:** 이 가이드라인은 속도보다 신중함에 가중치를 둔다. 사소한 작업에는 판단으로 조정.

## 1. 코딩 전에 생각하라
**가정하지 마라. 혼란을 숨기지 마라. 트레이드오프를 드러내라.**

구현 전에:
- 가정은 명시적으로 진술하라. 불확실하면 물어라.
- 해석이 여러 개라면 모두 제시하라 — 혼자 고르지 마라.
- 더 단순한 접근이 있으면 말하라. 필요하면 푸시백하라.
- 불명확하면 멈춰라. 무엇이 헷갈리는지 명명하고, 물어라.

## 2. 단순함이 먼저다
**문제를 푸는 최소 코드만 작성하라. 추측성 작업 금지.**

- 요청되지 않은 기능을 추가하지 마라.
- 1회용 코드에 추상화를 만들지 마라.
- 요청되지 않은 "유연성"이나 "설정 가능성"을 만들지 마라.
- 발생할 수 없는 시나리오에 대한 에러 처리를 만들지 마라.
- 200줄을 썼는데 50줄이면 충분하다면, 다시 써라.

자문: "시니어 엔지니어가 이걸 보고 과도하게 복잡하다고 할까?" 그렇다면 단순화하라.

## 3. 외과적 변경
**필요한 곳만 건드려라. 네가 만든 잔해만 치워라.**

기존 코드를 수정할 때:
- 인접한 코드, 주석, 포맷팅을 "개선"하지 마라.
- 망가지지 않은 것을 리팩토링하지 마라.
- 네가 다르게 했을 스타일이라도 기존 스타일에 맞춰라.
- 무관한 데드 코드를 발견하면 언급만 하고 삭제하지 마라.

네 변경이 고아(orphan)를 만든 경우:
- 너의 변경으로 인해 사용되지 않게 된 import/변수/함수는 정리하라.
- 기존부터 있던 데드 코드는 요청받지 않으면 건드리지 마라.

검증 기준: 변경된 모든 라인이 사용자의 요청으로 직접 추적 가능해야 한다.

## 4. 파일 편집 안전 규칙
**Edit은 외과 메스다. 쓰기 전에 현재 상태를 확인하라.**

- **함수·프롬프트 전체를 바꿀 때는 Write로.** Edit 여러 번 체이닝하지 마라. 긴 함수(30줄+) 수정, 프롬프트 재구성, return 위치 변경 → Write 한 번이 더 안전하다.
- **Edit 전에 파일을 Read하라.** 직전 Edit 이후 파일 상태가 불확실하면 반드시 Read로 현재 상태 확인 후 편집. 기억에 의존하지 마라.
- **return 삽입 시 특별 주의.** 함수 중간에 return을 추가하는 Edit은 나머지 코드를 dead code로 만들 수 있다. old_string에 return 이후 충분한 컨텍스트(최소 3줄)를 포함해서 의도치 않은 위치에 삽입되지 않도록 하라.
- **Edit 실패(문자열 불일치) 시 추측하지 마라.** 파일을 Read하고, 실제 현재 내용을 확인한 뒤 다시 시도하라.

자문: "이 Edit이 실패하면 파일이 어떤 상태가 되는가?" 복구하기 어려운 상태가 될 수 있다면 Write로 전체 재작성하라.

## 5. 목표 주도 실행
**성공 기준을 정의하라. 검증될 때까지 루프를 돌려라.**

작업을 검증 가능한 목표로 변환하라:
- "검증 추가" → "잘못된 입력에 대한 테스트를 작성하고, 통과시켜라"
- "버그 수정" → "버그를 재현하는 테스트를 작성하고, 통과시켜라"
- "X 리팩토링" → "전후로 테스트가 통과하는지 보장하라"

다단계 작업의 경우, 짧은 계획을 먼저 진술하라:
```
1. [단계] → verify: [검증]
2. [단계] → verify [검증]
3. [단계] → verify: [검증]
```

강한 성공 기준은 너의 독립적 루프를 가능하게 한다.
약한 기준("동작하게 만들어라")은 끊임없는 클러리피케이션을 요구한다.

---

## Current State (2026-06-07)

### 완료된 작업

**Phase 1 — 타로 리딩 루프 (완료)**
- `src/lib/systemPrompt.ts` — `buildReadingPrompt()` 구현
- `src/app/api/read/route.ts` — POST {cards, tags} → {reading} 반환. 이진 질문(예/아니오)과 일반 질문 결론 구분 처리
- `src/components/CardReading.tsx` — 카드 해석 결과 표시 (✦ 기호, TAG별 구분)
- `src/components/Terminal.tsx` — 카드 드로우 → 리딩 API 자동 호출 → 타이핑 애니메이션 출력 연동 완료
- `src/app/api/synthesis/route.ts` — `maxOutputTokens` 제거 (thinking 토큰 초과 방지)

**결제 연동 (완료)**
- `src/components/TossPaymentModal.tsx` — 전체 재작성. `next/script` + `window.PaymentWidget` 직접 호출로 "결제 모듈 로드 실패" 버그 수정. `safe_leave` sessionStorage 플래그로 beforeunload 경고 억제
- `next.config.ts` — `transpilePackages: ['@tosspayments/payment-widget-sdk']` 추가
- `src/app/api/payments/toss/confirm/route.ts` — idempotency 처리, Toss 금액 검증, 토큰 지급

**터미널 로그 (완료)**
- `src/lib/useTerminalLog.ts` — 자동 트림(200개 초과 시 오래된 항목 제거), `clearLogs()` 추가
- `src/components/Terminal.tsx` — `/clear` 커맨드 추가

### 미완료 / Pending

- **[중요] Supabase 마이그레이션 수동 실행 필요**
  - 파일: `supabase/migrations/20260607_add_toss_columns.sql`
  - 내용: `payments` 테이블에 `toss_order_id TEXT UNIQUE`, `toss_payment_key TEXT` 컬럼 추가
  - 방법: Supabase Dashboard → SQL Editor에서 해당 파일 내용 실행

### 기술 스택 메모
- Next.js 16 App Router, TypeScript, React 19
- Supabase Auth (cookie-based, RLS) — `profiles` 테이블: `token_balance`, `is_admin`
- Gemini 2.5 Flash API (thinking mode) — `@google/generative-ai`
- `@tosspayments/payment-widget-sdk` v0.12.1 (CJS, CDN 직접 로드로 우회)
- `useTerminalLog` — sessionStorage 기반 로그 유지 (`navType === 'navigate'` 복원, `'reload'` 초기화)

---

**이 가이드라인이 작동하고 있다는 신호:** diff에 불필요한 변경이 줄어들고,
과도한 복잡성으로 인한 재작성이 줄어들며, 클러리피케이션 질문이 실수 후가 아니라
구현 전에 나온다.
