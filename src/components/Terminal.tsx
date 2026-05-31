"use client";
import { useState, useEffect, useRef } from 'react';
import LogDisplay from './LogDisplay';
import InputLine from './InputLine';
import MenuSelector from './MenuSelector';
import CardReading, { type CardReadingResult } from './CardReading';
import CardGrid from './CardGrid';
import { useTerminalLog } from '@/lib/useTerminalLog';
import { type Card, type AlignmentAttempt, createFreshDeck, shuffleDeck, shuffleDeckWithAlignment, ALIGNMENT_MAX_RETRIES, drawCards } from '@/lib/shuffler';
import { createClient } from '@/lib/supabase';
import ShuffleOverlay from './ShuffleOverlay';
import { getCardById } from '@/lib/tarotData';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

type Position = {
  name: string;
  question: string;
};

type ReadingPlan = {
  type: 'QUESTION' | 'FLOW' | 'TIMING';
  cardCount: number;
  timeUnit?: '일' | '주' | '월';
  positions: Position[];
};

type FlowStep =
  | 'boot' | 'birthdate' | 'login' | 'login_email' | 'main'
  | 'ask_question' | 'confirm_identity' | 'analyzing'
  | 'confirm_context' | 'select_type' | 'confirm_plan'
  | 'confirm_flow_config' | 'ask_flow_period' | 'confirm_new_topic'
  | 'ready_to_draw' | 'card_draw'
  | 'token_shop' | 'token_shop_confirm';

const TOKEN_PACKAGES = [
  { id: 1, tokens: 3,  price: '990원' },
  { id: 2, tokens: 15, price: '4,450원' },
  { id: 3, tokens: 30, price: '8,910원' },
];

const LOGIN_OPTIONS = ['email', 'google', 'naver', 'kakao'];

// ─────────────────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────────────────

// 카드 ID → 타이밍 숫자 추출
// Major(0~21): 카드 번호 그대로, Minor: 에이스=1~10, 페이지=11, 기사=12, 퀸=13, 킹=14
function getTimingNumber(cardId: number): number {
  if (cardId <= 21) return cardId; // Major Arcana
  const posInSuit = (cardId - 22) % 14; // 수트 내 위치 (0=Ace, 9=Ten, 10=Page, 11=Knight, 12=Queen, 13=King)
  return posInSuit + 1; // 1~14
}

function parseReadingPlan(text: string): ReadingPlan | null {
  const typeMatch = text.match(/TYPE:\s*(QUESTION|FLOW|TIMING)/i);
  if (!typeMatch) return null;

  const type = typeMatch[1].toUpperCase() as 'QUESTION' | 'FLOW' | 'TIMING';

  // TIMING: 카드 1장, 포지션 1개
  if (type === 'TIMING') {
    return { type, cardCount: 1, positions: [{ name: '타이밍', question: '언제 가능한가' }] };
  }
  const cardsMatch = text.match(/CARDS:\s*(\d+)/i);
  const cardCount = cardsMatch ? Math.min(6, Math.max(1, parseInt(cardsMatch[1]))) : 1;

  let timeUnit: '일' | '주' | '월' | undefined;
  if (type === 'FLOW') {
    const timeMatch = text.match(/TIME_UNIT:\s*(일|주|월)/i);
    timeUnit = timeMatch ? (timeMatch[1] as '일' | '주' | '월') : '주';
  }

  const positions: Position[] = [];
  // `>` 구분자가 있으면 name > question, 없으면 전체를 question으로 사용
  const posRe = /POSITION_\d+\s*║\s*(.+)/gi;
  let m: RegExpExecArray | null;
  while ((m = posRe.exec(text)) !== null) {
    const raw = m[1].trim();
    const sepIdx = raw.indexOf('>');
    if (sepIdx !== -1) {
      positions.push({ name: raw.slice(0, sepIdx).trim(), question: raw.slice(sepIdx + 1).trim() });
    } else {
      positions.push({ name: raw, question: raw });
    }
  }

  if (positions.length === 0) return null;

  // positions 수가 cardCount와 다를 경우 맞춰줌
  const finalPositions = positions.slice(0, cardCount);
  while (finalPositions.length < cardCount) {
    finalPositions.push({ name: `포지션 ${finalPositions.length + 1}`, question: '이 시기의 지배 에너지는 무엇인가' });
  }

  return { type, cardCount, timeUnit, positions: finalPositions };
}

// CONFIRM 응답 파싱 — "항목: 값" 줄 배열로 추출
function parseConfirmLines(text: string): string[] {
  return text
    .split('\n')
    .slice(1) // "CONFIRM" 키워드 줄 제거
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('CONFIRM'));
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export default function Terminal() {
  const { logs, addLog, clearLogs, isLoaded } = useTerminalLog();
  const [step, setStep] = useState<FlowStep>('boot');
  const [isProcessing, setIsProcessing] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [questionContext, setQuestionContext] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState<boolean>(true); // 본인 질문 여부
  const [identityConfirmed, setIdentityConfirmed] = useState<boolean>(false); // 이번 세션 본인/타인 확인 여부
  const [readingPlan, setReadingPlan] = useState<ReadingPlan | null>(null);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  const [currentDeck, setCurrentDeck] = useState<Card[]>([]);
  const [drawnCards, setDrawnCards] = useState<Card[]>([]);
  const [cardReadings, setCardReadings] = useState<CardReadingResult[]>([]);
  const [pendingPositionIndex, setPendingPositionIndex] = useState<number>(0);

  const [copySnapshot, setCopySnapshot] = useState<string | null>(null);
  const [questionAttempts, setQuestionAttempts] = useState<number>(0);

  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleTopCard, setShuffleTopCard] = useState<Card | null>(null);
  const shuffleResolveRef = useRef<(() => void) | null>(null);

  const [deckIndex, setDeckIndex] = useState<number>(0);
  const [drawnDeckIndices, setDrawnDeckIndices] = useState<Set<number>>(new Set()); // 덱 위치 기반 비활성
  const [drawnCardIds, setDrawnCardIds] = useState<Set<number>>(new Set()); // 카드 ID 기반 중복 방지
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [prevTopicContext, setPrevTopicContext] = useState<string>(''); // 직전 리딩 주제 (새 주제 감지용)
  const [shopReturnStep, setShopReturnStep] = useState<FlowStep>('main'); // 충전 완료 후 복귀 단계
  const [pendingPackageId, setPendingPackageId] = useState<number | null>(null); // 선택 중인 토큰 패키지

  const currentOptions = step === 'login' ? LOGIN_OPTIONS : [];

  // ─────────────────────────────────────────────────────────
  // Shuffle helpers
  // ─────────────────────────────────────────────────────────

  const waitForShuffleAnimation = (): Promise<void> =>
    new Promise(resolve => {
      shuffleResolveRef.current = resolve;
      setIsShuffling(true);
    });

  const handleShuffleComplete = () => {
    setIsShuffling(false);
    addLog("[DANGER] REVERSING SECTOR_B (39 CARDS)... [OK]", "system");
    addLog("[PROCESS] RIFFLE_MERGE × 2 CYCLES... [OK]", "system");
    addLog("[STABILIZING] TRIPLE_CUT_REORDERING... [OK]", "system");
    if (shuffleTopCard) {
      addLog(
        `[OUTPUT] DECK TOP :: CARD #${String(shuffleTopCard.id + 1).padStart(2, '0')} ${shuffleTopCard.isReversed ? '[역방향]' : '[정방향]'}`,
        "system"
      );
    }
    shuffleResolveRef.current?.();
    shuffleResolveRef.current = null;
  };

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem('safe_leave');
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (window.sessionStorage.getItem('safe_leave') === 'true') return;
      if (logs.length > 5) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [logs.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, step, cardReadings]);

  useEffect(() => {
    if (!isLoaded) return;
    const init = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { isNewUser } = await loadTokenBalance();
        if (logs.length === 0) {
          // 새 세션 (로그인 후 첫 로드, 혹은 새로고침)
          await runConnectionSequence();
          await showMainMenu(isNewUser);
        } else {
          // OAuth 복귀 — 로그 이미 복원됨, 메뉴만 추가
          await showMainMenu(isNewUser);
        }
      } else {
        clearLogs();
        runBootSequence();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // ─────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────

  const runDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const runConnectionSequence = async () => {
    const rndIp = () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 254 + 1)).join('.');
    const greetings = [
      "마녀의 터미널에 접속했다.",
      "카드는 준비되어 있다.",
      "또 왔군.",
      "무엇이 알고 싶은가.",
      "카드는 거짓말을 하지 않는다.",
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    addLog("- - - - - - - - - - - - - - - -", "separator");
    await runDelay(300);
    addLog(`>> SIGNAL_DETECTED :: INITIATING_HANDSHAKE...`, "system");
    await runDelay(800);
    addLog(`>> REROUTING: ${rndIp()} → ${rndIp()} → ${rndIp()}`, "system");
    await runDelay(900);
    addLog(`>> BYPASS_01: PROXY_CHAIN_ALPHA...`, "system");
    await runDelay(1000);
    addLog(`   └ [OK]`, "system");
    await runDelay(500);
    addLog(`>> BYPASS_02: FIREWALL_SECTOR_4F...`, "system");
    await runDelay(1200);
    addLog(`   └ [OK]`, "system");
    await runDelay(500);
    addLog(`>> BYPASS_03: DARK_RELAY_NODE — ENCRYPTED...`, "system");
    await runDelay(1400);
    addLog(`   └ [OK]`, "system");
    await runDelay(600);
    addLog(`>> LOCATION: UNRESOLVABLE — SIGNAL_MASKED`, "system");
    await runDelay(500);
    addLog(`>> WARNING: 이 연결은 기록되지 않는다.`, "system");
    await runDelay(800);
    addLog("- - - - - - - - - - - - - - - -", "separator");
    await runDelay(400);
    addLog(greeting, "system");
    await runDelay(500);
  };

  const logAlignmentAttempts = async (attempts: AlignmentAttempt[]) => {
    for (let i = 0; i < attempts.length; i++) {
      const a = attempts[i];
      if (i > 0) {
        addLog(`>> REALIGN [${i}/${ALIGNMENT_MAX_RETRIES}] :: RESUMING FROM CURRENT STATE...`, "system");
        await runDelay(150);
      }
      addLog(`>> SCAN :: DECK_FACE_ANALYSIS`, "system");
      const ratioFlag = a.ratio >= 0.25 && a.ratio <= 0.75 ? '[OK]' : '[!!BIAS_DETECTED]';
      const runFlag = a.maxRun <= 15 ? '[OK]' : '[!!EXCEEDED]';
      addLog(`   REV: ${String(a.reversed).padStart(2,'0')} / UPR: ${String(a.upright).padStart(2,'0')} — RATIO: ${a.ratio.toFixed(2)} ${ratioFlag}`, "system");
      addLog(`   MAX_RUN: ${String(a.maxRun).padStart(2,'0')} — LIMIT: 15 ${runFlag}`, "system");
      addLog(`   CHECKSUM: ${a.checksum}`, "system");
      await runDelay(200);
    }
    const forced = attempts.length > ALIGNMENT_MAX_RETRIES;
    if (forced) {
      addLog(`>> FORCE_ALIGN :: RETRY_LIMIT_REACHED — PROCEEDING`, "system");
    } else {
      addLog(`>> ALIGNMENT :: PASSED — DECK_READY`, "system");
    }
    addLog(`LOADED :: 78 VARIABLES — ENTROPY STABLE`, "system");
  };

  const renderReadingPlan = (plan: ReadingPlan) => {
    const typeLabel = plan.type === 'FLOW' ? '흐름' : '질문';
    const timeLabel = plan.timeUnit ? ` | TIME: ${plan.timeUnit}단위` : '';
    addLog("▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓", "system", false);
    addLog(`[TYPE: ${typeLabel} | CARDS: ${plan.cardCount}장${timeLabel} | COST: ${plan.cardCount}토큰]`, "system");
    addLog("", "system", false);
    plan.positions.forEach((p, i) => {
      addLog(`POSITION_${String(i+1).padStart(2,'0')} ║ ${p.name}`, "system");
      addLog(`   > ${p.question}`, "system");
      if (i < plan.positions.length - 1) addLog("", "system", false);
    });
    addLog("▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓", "system", false);
  };

  // ─────────────────────────────────────────────────────────
  // Auth / Token
  // ─────────────────────────────────────────────────────────

  const loadTokenBalance = async (): Promise<{ isNewUser: boolean }> => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch('/api/tokens');
      if (res.ok) {
        const data = await res.json();
        setTokenCount(data.balance ?? 0);
        setIsAdmin(data.isAdmin ?? false);
        setIsLoggedIn(true);
        const key = `onboarding_done_${user?.id}`;
        const alreadySeen = localStorage.getItem(key) === 'true';
        if (!alreadySeen && user) {
          localStorage.setItem(key, 'true');
          return { isNewUser: true };
        }
      }
    } catch { /* fallback */ }
    return { isNewUser: false };
  };

  const showMainMenu = async (isNewUser: boolean) => {
    if (isNewUser) {
      addLog("- - - - - - - - - - - - - - - -", "separator", false);
      addLog("처음이군.", "system");
      await runDelay(800);
      addLog("가방 안을 확인하라.", "system");
      await runDelay(1000);
      addLog("...", "system");
      await runDelay(1000);
      addLog("토큰 3개가 들어 있다.", "system");
      setTokenCount(3);
      await runDelay(800);
      addLog("언제부터 있었던 것인지는 알 수 없다.", "system");
      await runDelay(500);
      addLog("- - - - - - - - - - - - - - - -", "separator", false);
    }
    addLog("[Q] 질문   [T] 토큰", "system");
    setIdentityConfirmed(false); // 새 질문 세션 시작 시 본인/타인 초기화
    setStep('main');
  };

  // ─────────────────────────────────────────────────────────
  // Boot / Login
  // ─────────────────────────────────────────────────────────

  const runBootSequence = async () => {
    setIsProcessing(true);
    await runConnectionSequence();
    addLog("", "system", false);
    await runDelay(400);
    addLog("14세 미만은 접근 불가.", "system");
    await runDelay(800);
    addLog("생년월일 8자리를 입력하라. 예) 19970224", "system");
    setStep('birthdate');
    setIsProcessing(false);
  };

  const processLoginFlow = async (option: string) => {
    setIsProcessing(true);
    const supabase = createClient();
    const providerMap: Record<string, 'google' | 'kakao' | 'naver'> = {
      google: 'google', kakao: 'kakao', naver: 'naver',
    };
    if (option.toLowerCase() === 'email') {
      addLog("■ 이메일 로그인은 현재 점검 중이다.", "system");
      await runDelay(400);
      addLog("Google, Kakao, Naver 중 하나를 선택하라.", "system");
      setIsProcessing(false);
      return;
    }
    const provider = providerMap[option.toLowerCase()];
    if (!provider) {
      addLog("■ 알 수 없는 선택이다.", "system");
      setIsProcessing(false);
      return;
    }
    addLog("외부 인증 서버로 이동한다...", "system");
    window.sessionStorage.setItem('safe_leave', 'true');
    await runDelay(600);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      window.sessionStorage.removeItem('safe_leave');
      addLog(`■ AUTH_ERROR: ${error.message}`, "system");
      setIsProcessing(false);
    }
  };

  const processLoginEmail = async (email: string) => {
    setIsProcessing(true);
    const supabase = createClient();
    addLog(`매직 링크를 전송한다: ${email}`, "system");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      addLog(`■ AUTH_ERROR: ${error.message}`, "system");
    } else {
      await runDelay(400);
      addLog("링크가 전송되었다. 받은 메일함을 확인하고 링크를 클릭하라.", "system");
      addLog("링크를 클릭하면 이 터미널로 돌아온다.", "system");
    }
    setIsProcessing(false);
  };

  // ─────────────────────────────────────────────────────────
  // Question → Analysis → Plan Confirm
  // ─────────────────────────────────────────────────────────

  const processAnalysis = async (context: string[], ownerFlag: boolean) => {
    setStep('analyzing');
    setIsProcessing(true);
    addLog("■ 질문 패턴 분석 중...", "system");
    await runDelay(400);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentInput: context[context.length - 1],
          context: context.slice(0, -1),
          isOwner: ownerFlag,
        }),
      });
      const data = await res.json();
      const aiText: string = data.analysis || '';

      const plan = parseReadingPlan(aiText);

      if (aiText.trimStart().startsWith('CONFIRM')) {
        // 본인 확인 후 — AI 추론 컨텍스트 확인 단계
        const confirmLines = parseConfirmLines(aiText);
        addLog("■ [CONTEXT_SCAN] :: 추론 완료", "system");
        await runDelay(200);
        for (const line of confirmLines) addLog(line, "system");
        addLog("", "system", false);
        addLog("[엔터]/Y: 확인 | 수정 내용 직접 입력", "system");
        setQuestionContext(prev => [...prev, `[추론 컨텍스트: ${confirmLines.join(' / ')}]`]);
        setStep('confirm_context');
        setIsProcessing(false);
        return;
      }

      if (plan) {
        // 경우 A — 플랜 확정
        setReadingPlan(plan);
        setQuestionAttempts(0);
        addLog("■ [READING_PLAN_DETECTED] :: 포지션 설계 완료", "system");
        await runDelay(300);

        if (plan.type === 'TIMING') {
          // TIMING: 바로 카드 1장 뽑기로 진행
          addLog("■ [TIMING_MODE] :: 타이밍 리딩 — 카드 1장", "system");
          await runDelay(200);
          addLog("카드 1장을 골라라.", "system");
          await processPlanConfirmation(plan);
        } else if (plan.type === 'FLOW') {
          // FLOW: 포지션 목록 대신 카드 수 + 시간단위 설정 화면으로 이동
          const unit = plan.timeUnit ?? '주';
          const n = plan.cardCount;
          addLog("■ [FLOW_MODE] :: 시간 흐름 리딩", "system");
          await runDelay(200);
          addLog(`>> 기본 설정: ${n}장 / ${unit}단위`, "system");
          addLog("", "system", false);
          addLog("샘플)", "system");
          addLog("  3장/월 → 1개월차·2개월차·3개월차", "system");
          addLog("  6장/주 → 1주차~6주차", "system");
          addLog("  4장/일 → 1일차~4일차", "system");
          addLog("", "system", false);
          addLog("설정 입력 (예: 6개월, 4주, 30일, 3개월치)", "system");
          addLog("[엔터]: 기본 설정으로 진행 | N: 취소", "system");
          setStep('confirm_flow_config');
        } else {
          // QUESTION: 기존 플랜 확인 흐름
          renderReadingPlan(plan);
          await runDelay(400);
          addLog("이대로 진행하려면 [엔터] 또는 Y", "system");
          addLog("카드 수 변경: 숫자 입력 (1~6)", "system");
          addLog("취소: N", "system");
          setStep('confirm_plan');
        }
      } else if (aiText.trimStart().startsWith('CHOICE')) {
        // 경우 C — QUESTION vs FLOW 선택지 제시 (선택지 내용만 출력)
        setQuestionAttempts(0);
        // CHOICE 이후 줄만 출력 (CHOICE 키워드 자체는 숨김)
        const choiceLines = aiText.split('\n').slice(1).filter(l => l.trim());
        for (const line of choiceLines) addLog(line, "system");
        addLog("", "system", false);
        addLog("1, 2, 3 중 하나를 입력하라.", "system");
        setStep('select_type');
      } else {
        // 경우 B — AI 추가 질문을 그대로 출력
        const newAttempts = questionAttempts + 1;
        setQuestionAttempts(newAttempts);

        if (newAttempts >= 4) {
          await processGlitchShutdown();
          return;
        }
        // AI가 생성한 ■ 질문 그대로 출력
        for (const line of aiText.split('\n')) {
          if (line.trim()) addLog(line, "system");
        }
        if (newAttempts === 2) {
          addLog("■ 오류 2회차: 연산 실패.", "system");
        } else if (newAttempts === 3) {
          addLog("■ 오류 3회차: 마지막 기회다.", "system");
        }
        setStep('ask_question');
      }
    } catch {
      addLog("■ 분석 회선 불안정. 잠시 후 다시 시도하라.", "system");
      setStep('ask_question');
    }

    setIsProcessing(false);
  };

  const processPlanConfirmation = async (plan: ReadingPlan) => {
    setIsProcessing(true);
    addLog("■ [PLAN_LOCKED] :: 리딩 플랜 확정", "system");
    await runDelay(400);

    // 꼬리질문이면 기존 덱 재사용, 최초 질문이면 새로 셔플
    const isFollowUpReading = currentDeck.length > 0;
    if (isFollowUpReading) {
      // 기존 덱 유지 — 이미 뽑힌 카드 위치/ID는 비활성 상태 그대로
      setCardReadings([]);
      setPendingPositionIndex(0);
      addLog(">> 기존 스프레드를 불러왔다.", "system");
      await runDelay(300);
    } else {
      const freshDeck = createFreshDeck();
      const { deck: shuffled, attempts: shuffleAttempts } = shuffleDeckWithAlignment(freshDeck);
      setCurrentDeck(shuffled);
      setDrawnCards([]);
      setCardReadings([]);
      setDeckIndex(0);
      setPendingPositionIndex(0);
      setDrawnDeckIndices(new Set());
      setDrawnCardIds(new Set());
      setShuffleTopCard(shuffled[0]);

      await waitForShuffleAnimation();
      await logAlignmentAttempts(shuffleAttempts);
      await runDelay(400);
    }

    const remaining = 15 - sessionCount;
    addLog(`카드 ${plan.positions.length}장을 순서대로 선택하라.`, "system");
    plan.positions.forEach((pos, i) => {
      addLog(`POSITION_${String(i+1).padStart(2,'0')} ║ ${pos.name} — "${pos.question}"`, "system");
    });
    addLog("", "system", false);
    addLog(`>> 잔여 드로우 ${remaining}/15 — 이 스프레드에서 최대 15장까지 뽑을 수 있다.`, "system");
    setStep('ready_to_draw');
    setIsProcessing(false);
  };

  // ─────────────────────────────────────────────────────────
  // Card Draw — 다중 선택 배치 처리
  // deckIndices: 사용자가 선택한 덱 인덱스 배열 (선택 순서 = 포지션 순서)
  // ─────────────────────────────────────────────────────────

  const processCardDraw = async (deckIndices: number[]) => {
    if (!readingPlan) return;
    setIsProcessing(true);

    const deckToUse = currentDeck.length > 0
      ? currentDeck
      : shuffleDeckWithAlignment(createFreshDeck()).deck;

    // 선택된 덱 위치를 즉시 비활성화
    const newDrawnSet = new Set([...drawnDeckIndices, ...deckIndices]);
    setDrawnDeckIndices(newDrawnSet);

    // 카드 ID 기반 중복 방지: 선택된 위치의 카드 ID를 미리 추가
    const selectedCardIds = deckIndices.map(idx => deckToUse[idx]?.id).filter(id => id !== undefined) as number[];
    const newCardIdSet = new Set([...drawnCardIds, ...selectedCardIds]);
    setDrawnCardIds(newCardIdSet);

    let accReadings: CardReadingResult[] = []; // 이번 리딩만 담음 (꼬리질문 각각 독립)
    let accDrawn = [...drawnCards];
    let newSessionCount = sessionCount;

    for (let i = 0; i < deckIndices.length; i++) {
      const targetIndex = deckIndices[i];
      const posIdx = pendingPositionIndex + i;
      const position = readingPlan.positions[posIdx];

      addLog(`카드 #${String(targetIndex + 1).padStart(2, '0')} 추출 중...`, "system");
      await runDelay(500);

      const drawn = drawCards(deckToUse, targetIndex, 1)[0];
      accDrawn = [...accDrawn, drawn];

      // 토큰 차감 (카드 1장당)
      try {
        const deductRes = await fetch('/api/tokens/deduct', { method: 'POST' });
        if (deductRes.ok) {
          const d = await deductRes.json();
          setTokenCount(d.balance);
          if (d.isAdmin !== undefined) setIsAdmin(d.isAdmin);
        } else if (deductRes.status === 402) {
          addLog("■ TOKEN_BALANCE: 0 — 토큰이 부족하다. [T]로 충전하라.", "system");
          setIsProcessing(false);
          return;
        }
      } catch {
        setTokenCount(prev => Math.max(0, prev - 1));
      }

      const cardData = getCardById(drawn.id);
      const dirLabel = drawn.isReversed ? '[역방향]' : '[정방향]';
      addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
      addLog(`CARD #${String(drawn.id + 1).padStart(2, '0')} — ${cardData.nameKo} ${dirLabel}`, "system");
      addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
      await runDelay(200);

      // TIMING 모드: 숫자 기반 시간 출력
      if (readingPlan?.type === 'TIMING') {
        const timingNum = getTimingNumber(drawn.id);
        const keywords = drawn.isReversed ? cardData.reversedKeywords : cardData.uprightKeywords;
        const keywordStr = keywords.slice(0, 2).join(', ');
        let timingLine: string;
        if (timingNum === 0) {
          timingLine = `"곧, 혹은 언제든지 가능하다."`;
        } else {
          timingLine = `"${timingNum}개월 혹은 ${timingNum}주 뒤."`;
        }
        const reading = `${timingLine}\n${cardData.nameKo}의 에너지 — ${keywordStr}.`;
        const result: CardReadingResult = {
          positionName: '타이밍',
          positionQuestion: '언제 가능한가',
          cardNum: drawn.id + 1,
          cardNameKo: cardData.nameKo,
          isReversed: drawn.isReversed,
          reading,
        };
        accReadings = [...accReadings, result];
        setCardReadings([...accReadings]);
        newSessionCount += 1;
        await runDelay(300);
        continue;
      }

      // 해석 API 호출
      addLog("✦ 오라클이 읽는다...", "system");
      try {
        const res = await fetch('/api/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card: {
              id: drawn.id,
              name: cardData.name,
              nameKo: cardData.nameKo,
              isReversed: drawn.isReversed,
              uprightKeywords: cardData.uprightKeywords,
              reversedKeywords: cardData.reversedKeywords,
            },
            position,
            questionContext: questionContext.join(' / '),
          }),
        });
        const readingData = await res.json();
        const reading: string = readingData.reading ?? '"카드는 침묵한다."\n오라클 회선이 불안정하다.';

        const result: CardReadingResult = {
          positionName: position.name,
          positionQuestion: position.question,
          cardNum: drawn.id + 1,
          cardNameKo: cardData.nameKo,
          isReversed: drawn.isReversed,
          reading,
        };
        accReadings = [...accReadings, result];
        setCardReadings([...accReadings]);

        newSessionCount += 1;
      } catch {
        addLog("■ 오라클 회선 불안정. 잠시 후 다시 시도하라.", "system");
      }

      await runDelay(300);
    }

    // 상태 일괄 업데이트
    setDrawnCards(accDrawn);
    setDeckIndex(Math.max(...deckIndices) + 1);
    setPendingPositionIndex(pendingPositionIndex + deckIndices.length);
    setSessionCount(newSessionCount);

    // 스냅샷 누적 업데이트 (꼬리질문 포함 모든 리딩 합산)
    const newSnapshotBlock = `[질문]\n${questionContext.join('\n')}\n\n` +
      accReadings.map(r =>
        `[${r.positionName}]\nCARD #${String(r.cardNum).padStart(2,'00')} — ${r.cardNameKo} ${r.isReversed ? '[역방향]' : '[정방향]'}\n${r.reading}`
      ).join('\n\n');
    setCopySnapshot(prev => prev ? `${prev}\n\n${'─'.repeat(28)}\n\n${newSnapshotBlock}` : newSnapshotBlock);

    // 리딩 완료 후 처리
    await runDelay(600);
    if (newSessionCount >= 15) {
      addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
      addLog("■ [SPREAD_EXHAUSTED] :: 이 주제에 대한 카드는 모두 소진되었다.", "system");
      await runDelay(300);
      addLog("마녀는 같은 주제를 다시 읽지 않는다.", "system");
      addLog("다른 이야기가 있다면 입력하라. 들어주겠다.", "system");
      setStep('card_draw');
    } else {
      addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
      addLog("■ 리딩 완료.", "system");
      addLog(`>> 잔여 드로우 ${15 - newSessionCount}/15`, "system");
      addLog("복사 또는 /copy 입력 시 전체 결과를 클립보드로 추출할 수 있다.", "system");
      addLog("", "system", false);
      addLog("꼬리질문이 있으면 입력하라.", "system");
      // 꼬리질문: 화면 카드 초기화 (copy 스냅샷은 누적 유지), context·plan 리셋
      // 주제 감지를 위해 현재 컨텍스트를 저장한 뒤 초기화
      setPrevTopicContext(questionContext.join(' '));
      setCardReadings([]);
      setQuestionContext([]);
      setQuestionAttempts(0);
      setReadingPlan(null);
      setStep('ask_question');
    }

    setIsProcessing(false);
  };

  const processReshuffle = async () => {
    if (sessionCount !== 0) return;
    setIsProcessing(true);
    const { deck: reshuffled, attempts } = shuffleDeckWithAlignment(createFreshDeck());
    setCurrentDeck(reshuffled);
    setDrawnCards([]);
    setCardReadings([]);
    setDeckIndex(0);
    setDrawnDeckIndices(new Set());
    setDrawnCardIds(new Set());
    setShuffleTopCard(reshuffled[0]);
    await waitForShuffleAnimation();
    await logAlignmentAttempts(attempts);
    addLog("재셔플 완료.", "system");
    if (readingPlan) {
      addLog("카드를 고르라. 번호 입력(예: 24) 또는 코드(예: C24)", "system");
      addLog(`POSITION_01 ║ ${readingPlan.positions[0].name} — "${readingPlan.positions[0].question}"`, "system");
    }
    setIsProcessing(false);
  };

  const processGlitchShutdown = async () => {
    addLog("■ 오류 한계치 도달.", "system");
    await runDelay(400);
    addLog("카드는 이 질문에 답할 의지가 없다.", "system");
    await runDelay(600);
    addLog("▓▒░ SESSION_CORRUPTED ░▒▓", "system");
    await runDelay(300);
    addLog("■■■ FORCE_RESET INITIATED ■■■", "system");
    await runDelay(300);
    addLog("흐릿한 영혼에게 낭비할 토큰은 없다. 터미널을 초기화한다.", "system");
    await runDelay(900);
    setQuestionAttempts(0);
    setQuestionContext([]);
    setReadingPlan(null);
    addLog("- - - - - - - - - - - - - - - -", "separator");
    addLog("무엇을 알고 싶은가.", "system");
    addLog("마녀의 카드는 들을 준비가 되었다.", "system");
    setStep('ask_question');
    setIsProcessing(false);
  };

  const processNewSession = async () => {
    setIsProcessing(true);
    const freshDeck = createFreshDeck();
    const shuffled = shuffleDeck(freshDeck);
    setCurrentDeck(shuffled);
    setDeckIndex(0);
    setSessionCount(0);
    setDrawnCards([]);
    setCardReadings([]);
    setReadingPlan(null);
    setQuestionContext([]);
    setQuestionAttempts(0);
    setShuffleTopCard(shuffled[0]);
    addLog("■ 새 세션. 덱을 초기화한다.", "system");
    await waitForShuffleAnimation();
    addLog("덱 초기화 완료.", "system");
    await runDelay(400);
    addLog("무엇을 알고 싶은가.", "system");
    setStep('ask_question');
    setIsProcessing(false);
  };

  // ─────────────────────────────────────────────────────────
  // Token Shop
  // ─────────────────────────────────────────────────────────

  const showTokenShop = async () => {
    addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
    addLog("토큰을 얻고자 한다면 대가를 지불하라.", "system");
    addLog("", "system", false);
    TOKEN_PACKAGES.forEach(p => {
      addLog(`${p.id}.  ${String(p.tokens).padStart(2)}토큰  —  ${p.price}`, "system");
    });
    addLog("", "system", false);
    addLog("번호를 선택하라.  N: 취소", "system");
    addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
    setStep('token_shop');
  };

  const processTokenCharge = async (packageId: number) => {
    setIsProcessing(true);
    const pkg = TOKEN_PACKAGES.find(p => p.id === packageId);
    if (!pkg) { setIsProcessing(false); return; }

    addLog("■ 결제 처리 중...", "system");
    await runDelay(800);

    try {
      const res = await fetch('/api/tokens/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      if (res.ok) {
        const data = await res.json();
        setTokenCount(data.balance);
        addLog(`✦ ${pkg.tokens}토큰 충전 완료. 현재 잔액: ${data.balance}토큰`, "system");
      } else {
        addLog("■ 결제 실패. 다시 시도하라.", "system");
      }
    } catch {
      addLog("■ 결제 회선 불안정. 잠시 후 다시 시도하라.", "system");
    }

    await runDelay(400);
    addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
    setStep(shopReturnStep);
    setIsProcessing(false);
  };

  // ─────────────────────────────────────────────────────────
  // Input Handler
  // ─────────────────────────────────────────────────────────

  const handleArrowKey = (key: 'ArrowUp' | 'ArrowDown') => {
    if (currentOptions.length > 0) {
      if (key === 'ArrowUp') setMenuIndex(prev => (prev > 0 ? prev - 1 : currentOptions.length - 1));
      else setMenuIndex(prev => (prev < currentOptions.length - 1 ? prev + 1 : 0));
    }
  };

  const handleUserInput = async (input: string) => {
    if (isProcessing || step === 'analyzing') return;

    // /logout
    if (input.trim().toLowerCase() === '/logout') {
      addLog('/logout', 'user');
      addLog('세션을 종료한다...', 'system');
      const supabase = createClient();
      await supabase.auth.signOut();
      clearLogs();
      setStep('boot');
      setTokenCount(0);
      setIsAdmin(false);
      setIsLoggedIn(false);
      setQuestionContext([]);
      setReadingPlan(null);
      setQuestionAttempts(0);
      setDrawnCards([]);
      setCardReadings([]);
      setCurrentDeck([]);
      setDeckIndex(0);
      setSessionCount(0);
      setCopySnapshot(null);
      runBootSequence();
      return;
    }

    // /code — 프로모 코드 입력
    const codeMatch = input.trim().match(/^\/code\s+(\S+)$/i);
    if (codeMatch) {
      addLog(input.trim(), 'user');
      const code = codeMatch[1];
      setIsProcessing(true);
      try {
        const res = await fetch('/api/tokens/code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (res.ok) {
          setTokenCount(data.balance);
          addLog(`✦ 코드 확인. ${data.tokensAdded}토큰이 지급되었다. 현재 잔액: ${data.balance}토큰`, "system");
        } else if (data.error === 'ALREADY_USED') {
          addLog("■ 이미 사용한 코드다.", "system");
        } else {
          addLog("■ 유효하지 않은 코드다.", "system");
        }
      } catch {
        addLog("■ 코드 확인 실패. 잠시 후 다시 시도하라.", "system");
      }
      setIsProcessing(false);
      return;
    }

    // Y/N 헬퍼
    const isYes = (s: string) => {
      const t = s.trim().toUpperCase();
      if (t === '' || ['Y', 'ㅛ', 'ㅇ', 'ㅇㅇ', 'ㅇㅋ', 'YY'].includes(t)) return true;
      return /^(응|어|맞아|맞음|ㄱ|ㄱㄱ|고|넹|넵|예|그래|오케|오케이|ok|okay)$/.test(t.toLowerCase());
    };
    const isNo = (s: string) => {
      const t = s.trim().toUpperCase();
      return ['N', 'NN', 'ㄴ', 'ㄴㄴ'].includes(t);
    };

    // /copy — 다양한 입력 인식
    const isCopyIntent = (s: string) => {
      const t = s.trim().toLowerCase();
      if (['c', '/copy', 'copy'].includes(t)) return true;
      return /복사|추출|카피/.test(t);
    };

    // 토큰 충전 — 어느 단계에서든 인식 (인증 전 단계 제외)
    const isTokenIntent = (s: string) => {
      const t = s.trim().toUpperCase();
      if (['T', 'ㅅ', 'ㅆ', 'ㅅㅅ', 'ㅆㅆ', 'ㅅㅆ', 'ㅆㅅ'].includes(t)) return true;
      return /토큰|충전/.test(s.trim());
    };
    const authSteps: FlowStep[] = ['boot', 'birthdate', 'login', 'login_email'];
    if (!authSteps.includes(step) && isTokenIntent(input)) {
      addLog(input.trim(), 'user');
      setShopReturnStep(step);
      await showTokenShop();
      return;
    }

    if (isCopyIntent(input)) {
      addLog(input.trim(), 'user');
      if (!copySnapshot) {
        addLog("■ 복사할 리포트가 없다. 카드를 먼저 추출하라.", "system");
      } else {
        try {
          await navigator.clipboard.writeText(copySnapshot);
          addLog("✦ 리포트가 클립보드에 복사되었다.", "system");
        } catch {
          addLog("■ 클립보드 접근 실패. 브라우저 권한을 확인하라.", "system");
        }
      }
      return;
    }

    // login
    if (step === 'login') {
      let selectedOption = '';
      if (input === '') {
        selectedOption = currentOptions[menuIndex];
        addLog(selectedOption, 'user');
      } else {
        addLog(input, 'user');
        const cleaned = input.replace(/[\[\]]/g, '').trim().toLowerCase();
        const matched = currentOptions.find(opt =>
          opt.replace(/[\[\]\s]/g, '').toLowerCase().includes(cleaned.replace(/\s/g, ''))
        );
        if (matched) selectedOption = matched;
        else { addLog("■ 알 수 없는 입력.", "system"); return; }
      }
      processLoginFlow(selectedOption);
      return;
    }

    // login_email
    if (step === 'login_email') {
      if (input === '') return;
      addLog(input, 'user');
      processLoginEmail(input);
      return;
    }

    // ready_to_draw
    if (step === 'ready_to_draw') {
      addLog(input, 'user');
      const trimmed = input.trim();
      if (trimmed === '한 번 더 셔플' || trimmed === '셔플') {
        if (sessionCount === 0) processReshuffle();
        else addLog("■ 드로우가 시작된 후에는 재셔플이 불가합니다.", "system");
        return;
      }
      const numMatch = trimmed.match(/^[Cc]?(\d{1,2})$/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        if (num >= 1 && num <= 78) { processCardDraw([num - 1]); return; }
        addLog("■ 1 ~ 78 사이의 번호를 입력하라.", "system");
        return;
      }
      if (trimmed === '') { processCardDraw([deckIndex]); return; }
      addLog("■ 카드 번호(예: 24 또는 C24)를 입력하거나 그리드에서 직접 선택하라.", "system");
      return;
    }

    // select_type (경우 C: QUESTION vs FLOW 선택)
    if (step === 'select_type') {
      addLog(input, 'user');
      const trimmed = input.trim();
      if (trimmed === '1') {
        // QUESTION 선택 — 컨텍스트에 타입 확정 지시 주입 후 바로 분석
        addLog("■ [QUESTION 모드] 구체적인 질문으로 전환한다.", "system");
        addLog("어떤 질문으로 볼 것인가? 한 문장으로 명확히 입력하라.", "system");
        // 컨텍스트에 모드 확정 지시 삽입 — 다음 분석에서 QUESTION으로 직행
        setQuestionContext(prev => [...prev, '[모드 확정: QUESTION — 구체적 질문으로 포지션 설계하라]']);
        setStep('ask_question');
        return;
      }
      if (trimmed === '2') {
        // FLOW 선택 — AI 재분석 없이 기간만 입력받아 바로 플랜 생성
        addLog("■ [FLOW 모드] 흐름 리딩으로 전환한다.", "system");
        addLog("기간을 입력하라. (예: 3개월, 6주, 30일)", "system");
        setStep('ask_flow_period');
        return;
      }
      if (trimmed === '3') {
        // 다른 질문 → 전체 초기화 후 재입력
        addLog("■ 다른 질문을 입력하라.", "system");
        setQuestionContext([]);
        setQuestionAttempts(0);
        setStep('ask_question');
        return;
      }
      addLog("■ 1, 2, 3 중 하나를 입력하라.", "system");
      return;
    }

    // ask_flow_period — FLOW 기간 입력 (select_type B에서 진입, AI 재분석 없이 바로 플랜 생성)
    if (step === 'ask_flow_period') {
      addLog(input, 'user');
      const trimmed = input.trim().toLowerCase();

      if (isNo(input)) {
        addLog("■ 취소. 질문을 다시 입력하라.", "system");
        setQuestionContext([]);
        setQuestionAttempts(0);
        setStep('ask_question');
        return;
      }

      const numRe = /(\d+)/;
      const numMatch = trimmed.match(numRe);
      if (numMatch) {
        const n = Math.min(12, Math.max(1, parseInt(numMatch[1])));
        let unit: '일' | '주' | '월' = '월';
        if (/주/.test(trimmed)) unit = '주';
        else if (/일/.test(trimmed)) { unit = '일'; }

        const positions = Array.from({ length: n }, (_, i) => ({
          name: `${unit}${i + 1}`,
          question: `${i + 1}${unit}차의 흐름`,
        }));
        const plan: ReadingPlan = { type: 'FLOW', cardCount: n, timeUnit: unit, positions };
        setReadingPlan(plan);
        addLog(`>> 설정 확정: ${n}장 / ${unit}단위`, "system");
        await runDelay(300);
        await processPlanConfirmation(plan);
        return;
      }

      addLog("■ 인식 불가. 예시: 6개월, 4주, 30일", "system");
      return;
    }

    // confirm_flow_config — 자연어로 카드 수 + 시간단위 설정
    if (step === 'confirm_flow_config') {
      addLog(input, 'user');
      if (!readingPlan) return;
      const trimmed = input.trim().toLowerCase();

      // 취소
      if (isNo(input)) {
        addLog("■ 프로토콜 취소. 질문을 다시 입력하라.", "system");
        setReadingPlan(null);
        setQuestionContext([]);
        setQuestionAttempts(0);
        setStep('ask_question');
        return;
      }

      // 자연어 파싱: "6개월", "6개월치", "6달", "4주", "4주치", "30일" 등
      const parseFlowConfig = (s: string): { cards: number; unit: '일' | '주' | '월' } | null => {
        const numRe = /(\d+)/;
        const numMatch = s.match(numRe);
        if (!numMatch) return null;
        const n = Math.min(12, Math.max(1, parseInt(numMatch[1])));
        if (/월|달|개월/.test(s)) return { cards: n, unit: '월' };
        if (/주/.test(s)) return { cards: n, unit: '주' };
        if (/일/.test(s)) return { cards: Math.min(30, n), unit: '일' };
        return null;
      };

      // 엔터 또는 Y → 기본값으로 진행
      if (isYes(input)) {
        processPlanConfirmation(readingPlan);
        return;
      }

      const parsed = parseFlowConfig(trimmed);
      if (parsed) {
        // 파싱 성공 → positions를 시간 슬롯으로 재생성
        const positions = Array.from({ length: parsed.cards }, (_, i) => ({
          name: `${parsed.unit}${i + 1}`,
          question: `${i + 1}${parsed.unit}차의 흐름`,
        }));
        const updated: ReadingPlan = {
          ...readingPlan,
          cardCount: parsed.cards,
          timeUnit: parsed.unit,
          positions,
        };
        setReadingPlan(updated);
        addLog(`>> 설정 확정: ${parsed.cards}장 / ${parsed.unit}단위`, "system");
        await runDelay(300);
        processPlanConfirmation(updated);
        return;
      }

      addLog("■ 인식 불가. 예시: 6개월, 4주, 30일", "system");
      return;
    }

    // token_shop — 패키지 선택
    if (step === 'token_shop') {
      addLog(input, 'user');
      const trimmed = input.trim();
      if (isNo(trimmed)) {
        addLog("■ 취소. 이전 상태로 돌아간다.", "system");
        setStep(shopReturnStep);
        return;
      }
      const num = parseInt(trimmed);
      const pkg = TOKEN_PACKAGES.find(p => p.id === num);
      if (pkg) {
        setPendingPackageId(pkg.id);
        addLog("", "system", false);
        addLog(`${pkg.tokens}토큰  —  ${pkg.price}`, "system");
        addLog("진행하겠는가?  [엔터]/Y: 확정   N: 취소", "system");
        setStep('token_shop_confirm');
        return;
      }
      addLog("■ 1, 2, 3 중 하나를 입력하라.", "system");
      return;
    }

    // token_shop_confirm — 결제 확정
    if (step === 'token_shop_confirm') {
      addLog(input, 'user');
      if (isYes(input)) {
        if (pendingPackageId) processTokenCharge(pendingPackageId);
        return;
      }
      if (isNo(input)) {
        addLog("■ 취소.", "system");
        setPendingPackageId(null);
        await showTokenShop();
        return;
      }
      addLog("■ [엔터]/Y: 확정   N: 취소", "system");
      return;
    }

    // confirm_plan
    if (step === 'confirm_plan') {
      addLog(input, 'user');
      const trimmed = input.trim().toLowerCase();
      if (!readingPlan) return;

      // 카드 수 변경
      const numMatch = trimmed.match(/^(\d+)$/);
      if (numMatch) {
        const n = Math.min(6, Math.max(1, parseInt(numMatch[1])));
        const updated: ReadingPlan = { ...readingPlan, cardCount: n };
        // positions 조정
        while (updated.positions.length < n) {
          updated.positions.push({ name: `포지션 ${updated.positions.length + 1}`, question: '이 시기의 지배 에너지는 무엇인가' });
        }
        updated.positions = updated.positions.slice(0, n);
        setReadingPlan(updated);
        addLog(`카드 수 변경: ${n}장`, "system");
        renderReadingPlan(updated);
        return;
      }

      // 시간단위 변경 (FLOW)
      if (readingPlan.type === 'FLOW' && (trimmed === '일' || trimmed === '주' || trimmed === '월')) {
        const updated = { ...readingPlan, timeUnit: trimmed as '일' | '주' | '월' };
        setReadingPlan(updated);
        addLog(`시간단위 변경: ${trimmed}단위`, "system");
        renderReadingPlan(updated);
        return;
      }

      // 취소
      if (isNo(input)) {
        addLog("■ 프로토콜 취소. 질문을 다시 입력하라.", "system");
        setReadingPlan(null);
        setQuestionContext([]);
        setQuestionAttempts(0);
        setStep('ask_question');
        return;
      }

      // 확정
      if (isYes(input)) {
        processPlanConfirmation(readingPlan);
        return;
      }

      addLog("■ [엔터]/Y: 확정 | N: 취소 | 숫자: 카드수 변경" + (readingPlan.type === 'FLOW' ? " | 일/주/월: 시간단위 변경" : ""), "system");
      return;
    }

    // card_draw (session limit) — 다음 질문을 그대로 입력하면 새 세션으로 이어짐
    if (step === 'card_draw' && sessionCount >= 15) {
      if (!input.trim()) return;
      addLog(input, 'user');
      // 전체 리셋 후 방금 입력한 질문을 첫 질문으로 사용
      setCurrentDeck([]);
      setDeckIndex(0);
      setSessionCount(0);
      setDrawnCards([]);
      setCardReadings([]);
      setDrawnDeckIndices(new Set());
      setDrawnCardIds(new Set());
      setReadingPlan(null);
      setQuestionAttempts(0);
      setIdentityConfirmed(false);
      const newContext = [input];
      setQuestionContext(newContext);
      addLog("■ 본인의 일인가, 타인의 일인가.", "system");
      addLog("Y: 본인   N: 타인", "system");
      setStep('confirm_identity');
      return;
    }

    // 빈 입력(엔터)은 confirm 계열 스텝에서만 허용 (Y로 처리)
    const confirmSteps: FlowStep[] = ['confirm_plan', 'confirm_flow_config', 'confirm_context', 'confirm_identity', 'ask_flow_period', 'login'];
    if (input === '' && !confirmSteps.includes(step)) return;
    addLog(input, 'user');

    // birthdate
    if (step === 'birthdate') {
      setIsProcessing(true);
      if (!/^\d{8}$/.test(input)) {
        addLog("■ 형식 오류. 8자리 숫자로 입력하라.", "system");
      } else {
        const year = parseInt(input.substring(0, 4));
        if (new Date().getFullYear() - year < 14) {
          addLog("■ 접근 불가.", "system");
        } else {
          addLog("확인.", "system");
          await runDelay(500);
          addLog("로그인 방법을 선택하라.", "system");
          setMenuIndex(0);
          setStep('login');
        }
      }
      setIsProcessing(false);
      return;
    }

    // main
    if (step === 'main') {
      const isQuestionIntent = (s: string) => {
        const t = s.trim().toUpperCase();
        // Q 키 + 한글 자모 변형
        if (['Q', 'ㅂ', 'ㅃ', 'ㅂㅂ', 'ㅃㅃ'].includes(t)) return true;
        const lower = s.trim();
        // 질문·타로 관련 키워드 (ㄱㄱ·할래·해줘 등 후치사 무관)
        return /질문|고민|물어|타로|봐줘|봐줄래|봐 줘|카드|리딩|점봐|점 봐|뽑아|궁금|상담|운세|점괘/.test(lower);
      };
      if (isQuestionIntent(input)) {
        setIsProcessing(true);
        addLog("무엇을 알고 싶은가.", "system");
        await runDelay(400);
        addLog("마녀의 카드는 들을 준비가 되었다.", "system");
        setQuestionContext([]);
        setStep('ask_question');
        setIsProcessing(false);
      } else {
        addLog("■ 알 수 없는 입력. [Q] 또는 [T]를 입력하라.", "system");
      }
      return;
    }

    // ask_question — 꼬리질문이거나 이미 본인/타인 확인됐으면 바로 분석
    if (step === 'ask_question') {
      // 주제 일관성 감지: 이전 리딩이 있고(sessionCount > 0), 새 질문이 시작되는 시점(questionContext 비어있음)에만 체크
      // 명시적 새 주제 의도 OR 카테고리가 다른 주제로 판단될 때 확인 요청
      const detectTopicChange = (prevCtx: string, newInput: string): boolean => {
        if (!prevCtx) return false;
        const topicGroups: RegExp[] = [
          /연애|연인|사랑|이별|재회|짝사랑|고백|남친|여친|남자친구|여자친구|썸|헤어|사귀/,
          /이직|취업|직장|커리어|업무|회사|직업|취준|퇴사|입사|면접|일자리/,
          /건강|몸|아프|병원|치료|다이어트|체중|수술/,
          /가족|부모|엄마|아빠|형제|자매|부모님|남편|아내|배우자/,
          /돈|재정|투자|부업|수입|적금|주식|빚|대출|자산/,
          /친구|인간관계|갈등|관계|지인|동료|상사/,
          /학업|공부|시험|학교|수능|입시|대학/,
        ];
        const getCategories = (text: string) =>
          topicGroups.reduce<number[]>((acc, re, i) => re.test(text) ? [...acc, i] : acc, []);

        const prevCats = getCategories(prevCtx);
        const newCats = getCategories(newInput);
        // 둘 다 카테고리가 명확하고 겹치지 않을 때만 주제 변경으로 판단
        if (prevCats.length === 0 || newCats.length === 0) return false;
        return !newCats.some(c => prevCats.includes(c));
      };

      // 명시적 새 주제 키워드 감지
      const hasExplicitNewTopicKeyword = (s: string) =>
        /새\s*질문|다른\s*이야기|다른\s*주제|새\s*주제|다른\s*고민|처음부터|다시\s*시작|새로\s*시작/.test(s.trim().toLowerCase());

      if (sessionCount > 0 && questionContext.length === 0) {
        const isChanged = hasExplicitNewTopicKeyword(input) || detectTopicChange(prevTopicContext, input);
        if (isChanged) {
          // 새 셔플 필요 — 확인 요청
          addLog("■ 지금의 이야기는 여기서 닫힌다.", "system");
          addLog("새로운 주제를 위해 덱을 다시 섞어야 한다.", "system");
          addLog("이대로 진행하겠는가?  Y: 계속   N: 현재 이야기 유지", "system");
          setStep('confirm_new_topic');
          return;
        }
      }

      const updated = [...questionContext, input];
      setQuestionContext(updated);
      const isFollowUp = questionContext.length > 0;
      if (isFollowUp || identityConfirmed) {
        // 꼬리질문 or 이미 확인됨 → 본인/타인 재확인 없이 바로 분석
        await processAnalysis(updated, isOwner);
      } else {
        addLog("■ 본인의 일인가, 타인의 일인가.", "system");
        addLog("Y: 본인   N: 타인", "system");
        setStep('confirm_identity');
      }
    }

    // confirm_new_topic — 새 주제 전환 확인
    if (step === 'confirm_new_topic') {
      addLog(input, 'user');
      if (isYes(input)) {
        // 전체 리셋
        setCurrentDeck([]);
        setDeckIndex(0);
        setSessionCount(0);
        setDrawnCards([]);
        setCardReadings([]);
        setDrawnDeckIndices(new Set());
        setDrawnCardIds(new Set());
        setReadingPlan(null);
        setQuestionAttempts(0);
        setIdentityConfirmed(false);
        setCopySnapshot(null);
        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
        addLog("■ 덱을 초기화한다. 새로운 이야기를 입력하라.", "system");
        setQuestionContext([]);
        setStep('ask_question');
      } else if (isNo(input)) {
        addLog("■ 현재 이야기를 계속한다. 꼬리질문을 입력하라.", "system");
        setStep('ask_question');
      } else {
        addLog("■ Y 또는 N을 입력하라.", "system");
      }
      return;
    }

    // confirm_identity
    if (step === 'confirm_identity') {
      addLog(input, 'user');
      const t = input.trim().toUpperCase();
      const isSelf = (s: string) => {
        if (['Y', 'ㅛ', 'ㅇ', 'ㅇㅇ', 'YY'].includes(s)) return true;
        return /^(본인|나|나야|맞아|맞음|응|어|넹|넵|예|ㅇㅇ|ㅇㅋ|ㄴㄴ아니고나|그래|나임|내꺼|내거)$/.test(s) || /^나[야이임]?$/.test(s);
      };
      const isOther = (s: string) => {
        if (['N', 'ㄴ', 'ㄴㄴ', 'ㅜ', 'NN'].includes(s)) return true;
        return /타인|남|다른\s*사람|다른사람|친구|남자친구|여자친구|애인|지인|가족|오빠|언니|동생|엄마|아빠|남사친|여사친|남친|여친/.test(s);
      };
      if (t === '' || isSelf(t)) {
        // 본인 — AI 추론 컨텍스트 확인 포함 분석
        setIsOwner(true);
        setIdentityConfirmed(true);
        await processAnalysis(questionContext, true);
      } else if (isOther(t)) {
        // 타인 — 프라이버시 고지 후 익명 분석
        setIsOwner(false);
        setIdentityConfirmed(true);
        addLog("", "system", false);
        addLog("■ 마녀는 타인의 기록을 남기지 않는다.", "system");
        addLog("이 세션이 끝나면 모든 것은 사라진다.", "system");
        await runDelay(500);
        await processAnalysis(questionContext, false);
      } else {
        addLog("■ 본인이면 Y, 타인이면 N을 입력하라.", "system");
      }
    }

    // confirm_context — 추론 컨텍스트 확인/수정
    if (step === 'confirm_context') {
      addLog(input, 'user');
      const t = input.trim();
      if (t === '' || t.toUpperCase() === 'Y') {
        // 확인 — 현재 컨텍스트로 분석 재개
        await processAnalysis(questionContext, isOwner);
      } else {
        // 수정 내용을 컨텍스트에 추가 후 재분석
        const corrected = [...questionContext, `[컨텍스트 수정: ${t}]`];
        setQuestionContext(corrected);
        await processAnalysis(corrected, isOwner);
      }
    }
  };

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  if (!isLoaded) return null;

  return (
    <div className="w-full max-w-[468.5px] my-4 h-[92dvh] max-h-[1002px] sm:aspect-[9/20] border border-[#00FF41] rounded-[20px] sm:rounded-[45px] p-[20px] bg-black flex flex-col relative mx-auto shadow-[0_0_20px_rgba(0,255,65,0.2)] overflow-hidden">

      {/* 상단 배너 */}
      <div
        className="shrink-0 pb-2 mb-1 font-mono text-[13px] leading-none"
        style={{
          color: '#00FF41',
          borderBottom: '1px solid rgba(0,255,65,0.25)',
          letterSpacing: '0.03em',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>[CODED-TAROT_OS v0.78]</span>
        <span style={{ flex: 1, overflow: 'hidden', color: 'rgba(0,255,65,0.3)', letterSpacing: '0.08em', textAlign: 'center', userSelect: 'none' }}>
          {'─'.repeat(20)}
        </span>
        <span style={{ whiteSpace: 'nowrap', color: isAdmin ? '#FFD700' : !isLoggedIn ? '#00FF41' : tokenCount <= 0 ? '#FF3300' : '#00FF41' }}>
          {isAdmin ? '[TOKEN: ∞]' : !isLoggedIn ? '[TOKEN: ?]' : `[TOKEN: ${tokenCount}]`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
        <div className="pt-4">
          <LogDisplay logs={logs} />
        </div>

        {/* 카드 해석 결과 */}
        {cardReadings.map((result, i) => (
          <CardReading key={i} result={result} />
        ))}

        {/* 셔플 애니메이션 */}
        {isShuffling && (
          <ShuffleOverlay
            topCard={shuffleTopCard}
            onComplete={handleShuffleComplete}
            scrollToBottom={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          />
        )}

        {/* 78장 카드 코드 그리드 */}
        {step === 'ready_to_draw' && currentDeck.length > 0 && !isProcessing && readingPlan && (
          <CardGrid
            deck={currentDeck}
            requiredCount={readingPlan.positions.length - pendingPositionIndex}
            disabledIndices={
              // 덱 위치 비활성 + 카드 ID 중복 비활성 합산
              new Set([
                ...drawnDeckIndices,
                ...currentDeck.reduce<number[]>((acc, card, idx) =>
                  drawnCardIds.has(card.id) ? [...acc, idx] : acc, [])
              ])
            }
            onSelectAll={(deckIndices) => processCardDraw(deckIndices)}
          />
        )}

        {/* 로그인 메뉴 */}
        {step === 'login' && !isProcessing && (
          <MenuSelector
            options={currentOptions}
            selectedIndex={menuIndex}
            onSelect={(opt) => { addLog(opt, 'user'); processLoginFlow(opt); }}
          />
        )}

        <div ref={bottomRef} className="h-4 shrink-0" />
      </div>

      {(step !== 'card_draw' || sessionCount >= 15) && (
        <div className="shrink-0 pt-2 pb-2 bg-black">
          <InputLine
            onSubmit={handleUserInput}
            onArrowKey={handleArrowKey}
            disabled={isProcessing}
            allowEmpty={(['confirm_plan', 'confirm_flow_config', 'confirm_context', 'confirm_identity', 'ask_flow_period', 'confirm_new_topic', 'token_shop_confirm', 'login'] as FlowStep[]).includes(step)}
          />
        </div>
      )}
    </div>
  );
}
