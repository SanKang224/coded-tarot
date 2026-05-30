# 필수 패턴 목록 — CODED TAROT (부록 N)

## 시각 디자인 필수
- 배경: #000000 (oklch(0% 0 0))
- 주색: #00FF41 (oklch(80% 0.23 140)) — 터미널 그린
- 위험색: #FF3300 — 시스템 경고에만 사용
- 폰트: monospace (Courier New)
- 글자 크기: 16px / line-height 1.8
- 터미널 테두리: 1px solid #00FF41, border-radius 20px(모바일) / 45px(데스크톱)

## AI 문체 필수
- 모든 시스템 출력 앞: `■ `
- 마녀 카드 해석 앞: `✦ `
- 어미: ~다. / ~인가. / ~하라.
- 섹터 구분: `TAG 01 ║` / `TAG 02 ║` / `TAG 03 ║`
- 78장 덱 기준 / 역방향(isReversed) 포함

## 기능 필수
- 물리 셔플: split → flip(역방향) → riffle merge × 2~3회 → 3-way cut
- 세션 내 덱 연속성 (카드 중복 없음, 포인터 유지)
- 최대 5회 질문/세션
- 생년월일 14세 미만 차단
- localStorage 세션 로그 영속화 (새로고침 시 초기화)

## 컴포넌트 필수
- `<Terminal />` — 전체 게임 루프
- `<LogDisplay />` — 타이핑 애니메이션 로그
- `<InputLine />` — 터미널 입력창
- `<MenuSelector />` — 방향키 메뉴
- `<ShuffleOverlay />` — 셔플 애니메이션
- `<CardReading />` — 카드 해석 출력 (미구현 → Phase 3 대상)
