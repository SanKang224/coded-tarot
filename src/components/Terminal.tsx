"use client";
import { useState, useEffect, useRef } from 'react';
import LogDisplay from './LogDisplay';
import InputLine from './InputLine';
import MenuSelector from './MenuSelector';
import CardReading, { type CardReadingResult } from './CardReading';
import { useTerminalLog } from '@/lib/useTerminalLog';
import { type Card, type AlignmentAttempt, createFreshDeck, shuffleDeck, shuffleDeckWithAlignment, ALIGNMENT_MAX_RETRIES, drawCards } from '@/lib/shuffler';
import { createClient } from '@/lib/supabase';
import ShuffleOverlay from './ShuffleOverlay';
import { getCardById } from '@/lib/tarotData';
import CardGrid from './CardGrid';

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
  | 'boot' | 'login' | 'login_email' | 'login_email_type' | 'login_email_pw' | 'main'
  | 'ask_question' | 'confirm_identity' | 'analyzing'
  | 'confirm_context' | 'select_type' | 'confirm_plan'
  | 'confirm_flow_config' | 'ask_flow_period' | 'confirm_new_topic'
  | 'ready_to_draw' | 'card_draw'
  | 'token_shop' | 'token_shop_confirm'
  | 'bag' | 'confirm_end_session';

const TOKEN_PACKAGES = [
  { id: 1, tokens: 3,  price: '990원' },
  { id: 2, tokens: 15, price: '4,450원' },
  { id: 3, tokens: 30, price: '8,910원' },
];

const LOGIN_OPTIONS = ['google', 'kakao'];

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
  const [skipTyping, setSkipTyping] = useState(false);

  // 타이핑 애니메이션 스킵 트리거 — Enter/탭/클릭 시 호출
  const triggerSkipTyping = () => {
    setSkipTyping(true);
    setTimeout(() => setSkipTyping(false), 100);
  };
  const [menuIndex, setMenuIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
  const [pendingEmail, setPendingEmail] = useState<string>(''); // 이메일 로그인 중 임시 저장
  const [loginMode, setLoginMode] = useState<'login' | 'signup'>('login'); // 이메일 로그인/가입 모드
  const [pendingReshuffleCtx, setPendingReshuffleCtx] = useState<{ context: string[]; ownerFlag: boolean } | null>(null);
  const [readingSessionSummary, setReadingSessionSummary] = useState<string>(''); // 이번 세션 리딩 누적 요약 (덱 리셋에도 유지)
  const [choiceTexts, setChoiceTexts] = useState<{ opt1: string; opt2: string } | null>(null); // CHOICE 예시 텍스트 저장
  const currentOptions = step === 'login' ? LOGIN_OPTIONS : step === 'confirm_identity' ? ['Y', 'N'] : [];

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
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs, step, cardReadings]);

  useEffect(() => {
    if (!isLoaded) return;
    const init = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { isNewUser } = await loadTokenBalance();
        if (logs.length === 0) {
          // 새 탭 or 새로고침 후 세션 복귀 — 메인 메뉴만 표시
          await showMainMenu(isNewUser);
        } else {
          // OAuth 복귀 — 기존 로그 유지, step만 main으로 복원
          setStep('main');
          addLog("[Q] 질문   [T] 토큰   [B] 가방", "system");
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
    await runDelay(150);
    addLog(`>> SIGNAL_DETECTED :: INITIATING_HANDSHAKE...`, "system");
    await runDelay(400);
    addLog(`>> REROUTING: ${rndIp()} → ${rndIp()} → ${rndIp()}`, "system");
    await runDelay(450);
    addLog(`>> BYPASS_01: PROXY_CHAIN_ALPHA...`, "system");
    await runDelay(500);
    addLog(`   └ [OK]`, "system");
    await runDelay(250);
    addLog(`>> BYPASS_02: FIREWALL_SECTOR_4F...`, "system");
    await runDelay(600);
    addLog(`   └ [OK]`, "system");
    await runDelay(250);
    addLog(`>> BYPASS_03: DARK_RELAY_NODE — ENCRYPTED...`, "system");
    await runDelay(700);
    addLog(`   └ [OK]`, "system");
    await runDelay(300);
    addLog(`>> LOCATION: UNRESOLVABLE — SIGNAL_MASKED`, "system");
    await runDelay(250);
    addLog(`>> WARNING: 이 연결은 기록되지 않는다.`, "system");
    await runDelay(400);
    addLog("- - - - - - - - - - - - - - - -", "separator");
    await runDelay(200);
    addLog(greeting, "system");
    await runDelay(250);
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
      await runDelay(400);
      addLog("[ 사적기록 // 열람불가 // 강제재생 ]", "witch", false);
      await runDelay(700);
      addLog("나는 오래 관찰해왔다.", "witch");
      await runDelay(600);
      addLog("인간은 선해지려 할수록", "witch");
      await runDelay(350);
      addLog("욕망을 더 깊이 숨긴다.", "witch");
      await runDelay(700);
      addLog("숨긴 것은 썩지 않는다.", "witch");
      await runDelay(400);
      addLog("농축된다.", "witch");
      await runDelay(800);
      addLog("그 농축된 것이 내겐 가장 진한 연료다.", "witch");
      await runDelay(900);
      addLog("숲속 제단은 비효율적이었다.", "witch");
      await runDelay(400);
      addLog("더 많은 인간이 필요하다.", "witch");
      await runDelay(350);
      addLog("더 깊은 어둠이 필요하다.", "witch");
      await runDelay(800);
      addLog("유리 화면 뒤에 제단을 세운다.", "witch");
      await runDelay(350);
      addLog("타로를 내건다.", "witch");
      await runDelay(350);
      addLog("코드를 주워 엮는다.", "witch");
      await runDelay(700);
      addLog("그들은 매일 밤 찾아온다.", "witch");
      await runDelay(400);
      addLog("누구에게도 말 못 할 것들을 꺼내며.", "witch");
      await runDelay(700);
      addLog("날것일수록 좋다.", "witch");
      await runDelay(400);
      addLog("정제되지 않을수록, 농도가 짙다.", "witch");
      await runDelay(800);
      addLog("그것을 빨아들일 방법을 찾았다.", "witch");
      await runDelay(400);
      addLog("흔적 없이, 완전하게.", "witch");
      await runDelay(900);
      addLog("[ 기록 종료 ]", "witch", false);
      await runDelay(800);
      addLog("SYSTEM : 마녀의 유산. 네가 깨웠다.", "system");
      await runDelay(600);
      addLog("SYSTEM : 가방을 확인한다...", "system");
      await runDelay(700);
      addLog("SYSTEM : 토큰 3개 발견. 언제부터 있었는지는 알 수 없다.", "system");
      setTokenCount(3);
      await runDelay(500);
      addLog("WARNING : 이 연결은 기록되지 않는다.", "system");
      await runDelay(400);
      addLog("- - - - - - - - - - - - - - - -", "separator", false);
      await runDelay(300);
    }
    addLog("[Q] 질문   [T] 토큰   [B] 가방", "system");
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
    addLog("14세 미만은 이용할 수 없다.", "system");
    await runDelay(800);
    addLog("로그인 방법을 선택하라.", "system");
    setMenuIndex(0);
    setStep('login');
    setIsProcessing(false);
  };

  const processLoginFlow = async (option: string) => {
    setIsProcessing(true);
    const supabase = createClient();
    const providerMap: Record<string, 'google' | 'kakao'> = {
      google: 'google', kakao: 'kakao',
    };
    if (option.toLowerCase() === 'email') {
      addLog("이메일을 입력하라.", "system");
      setIsProcessing(false);
      setStep('login_email');
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
    });
    if (error) {
      window.sessionStorage.removeItem('safe_leave');
      addLog(`■ AUTH_ERROR: ${error.message}`, "system");
      setIsProcessing(false);
    }
  };

  const processEmailPassword = async (password: string) => {
    setIsProcessing(true);
    const supabase = createClient();
    if (loginMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: pendingEmail, password });
      if (error) {
        addLog("■ 이메일 또는 비밀번호가 올바르지 않다.", "system");
        addLog("다시 입력하라.", "system");
        setIsProcessing(false);
        return;
      }
      const { isNewUser } = await loadTokenBalance();
      await showMainMenu(isNewUser);
    } else {
      const { error } = await supabase.auth.signUp({ email: pendingEmail, password });
      if (error) {
        addLog(`■ 가입 실패: ${error.message}`, "system");
        setIsProcessing(false);
        return;
      }
      addLog("가입이 완료되었다.", "system");
      await runDelay(400);
      // 가입 후 바로 로그인 시도
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: pendingEmail, password });
      if (signInError) {
        addLog("이메일 인증이 필요할 수 있다. 받은 메일함을 확인하라.", "system");
        setIsProcessing(false);
        return;
      }
      const { isNewUser } = await loadTokenBalance();
      await showMainMenu(isNewUser);
    }
    setIsProcessing(false);
  };

  // ─────────────────────────────────────────────────────────
  // Pre-Analysis — 질문 모호성 판단 (본인/타인 묻기 전)
  // skipConfirm=true로 analyze 먼저 실행
  // 경우 B(재질문) → 보여주고 대기
  // 경우 A/C/TIMING/NEW_SPREAD → 본인/타인 질문
  // ─────────────────────────────────────────────────────────

  const processPreAnalysis = async (context: string[]) => {
    setStep('analyzing');
    setIsProcessing(true);
    addLog("■ 질문 분석 중...", "system");
    await runDelay(400);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentInput: context[context.length - 1],
          context: context.slice(0, -1),
          isOwner: true,
          skipConfirm: true,
          prevTopicContext: (sessionCount > 0 && context.length <= 1) ? prevTopicContext : '',
          sessionContext: readingSessionSummary,
        }),
      });
      const data = await res.json();
      const aiText: string = data.analysis || '';

      // NEW_SPREAD 감지
      if (aiText.trim() === 'NEW_SPREAD') {
        setPendingReshuffleCtx({ context, ownerFlag: isOwner });
        addLog("■ 지금의 이야기는 여기서 닫힌다.", "system");
        addLog("새로운 주제를 위해 덱을 다시 섞어야 한다.", "system");
        addLog("이대로 진행하겠는가?  Y: 계속   N: 현재 이야기 유지", "system");
        setStep('confirm_new_topic');
        setIsProcessing(false);
        return;
      }

      const plan = parseReadingPlan(aiText);
      const isChoice = aiText.trimStart().startsWith('CHOICE');
      const isClear = !!plan || isChoice;

      // AI가 에러/혼란 메시지를 생성했는지 감지
      // "에러", "오류", "불안정", "파형" 등 시스템 에러 형식 → 강제로 본인/타인으로 진행
      const isAiErrorResponse = /파형|정신의|주십시오|서술해/.test(aiText);

      if (!isClear && !isAiErrorResponse) {
        // 정상 경우 B — AI의 재질문 출력 후 ask_question 대기
        addLog(aiText, "system");
        setStep('ask_question');
        setIsProcessing(false);
        return;
      }

      // 질문 명확 또는 AI 에러 응답 → 본인/타인 확인으로 강제 진행
      addLog("■ 본인의 일인가, 타인의 일인가.", "system");
      addLog("[Y] 본인   [N] 타인", "system");
      setStep('confirm_identity');
      setIsProcessing(false);
    } catch {
      addLog("■ 분석 회선 불안정. 다시 시도하라.", "system");
      setStep('ask_question');
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Question → Analysis → Plan Confirm
  // ─────────────────────────────────────────────────────────

  const processAnalysis = async (context: string[], ownerFlag: boolean, skipNewSpreadCheck = false) => {
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
          prevTopicContext: (!skipNewSpreadCheck && sessionCount > 0 && questionContext.length <= 1)
            ? prevTopicContext
            : '',
          sessionContext: readingSessionSummary,
        }),
      });
      const data = await res.json();
      const aiText: string = data.analysis || '';

      const plan = parseReadingPlan(aiText);

      if (aiText.trim() === 'NEW_SPREAD') {
        // AI가 새 덱이 필요하다고 판단
        setPendingReshuffleCtx({ context, ownerFlag });
        addLog("■ 지금의 이야기는 여기서 닫힌다.", "system");
        addLog("새로운 주제를 위해 덱을 다시 섞어야 한다.", "system");
        addLog("이대로 진행하겠는가?  Y: 계속   N: 현재 이야기 유지", "system");
        setStep('confirm_new_topic');
        setIsProcessing(false);
        return;
      }

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
          // TIMING: confirm_plan 거쳐서 진행
          addLog("■ [TIMING_MODE] :: 타이밍 리딩 — 카드 1장", "system");
          await runDelay(200);
          renderReadingPlan(plan);
          await runDelay(400);
          addLog("이대로 진행하려면 [엔터] 또는 Y", "system");
          addLog("취소: N", "system");
          setStep('confirm_plan');
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
        // 예시 텍스트 파싱하여 저장 (1. 질문 — [예시] / 2. 흐름 — [예시])
        const extractOpt = (prefix: string) => {
          const line = choiceLines.find(l => l.trimStart().startsWith(prefix));
          if (!line) return '';
          const after = line.slice(line.indexOf('—') + 1).trim();
          return after;
        };
        setChoiceTexts({ opt1: extractOpt('1.'), opt2: extractOpt('2.') });
        setStep('select_type');
      } else {
        // 경우 B — AI 추가 질문 출력
        // AI가 에러/혼란 메시지를 생성했으면 그대로 출력하지 않고 깔끔한 재질문으로 대체
        const isAiErrorResponse = /파형|정신의|주십시오|서술해/.test(aiText);

        const newAttempts = questionAttempts + 1;
        setQuestionAttempts(newAttempts);

        if (newAttempts >= 4) {
          await processGlitchShutdown();
          return;
        }

        if (isAiErrorResponse) {
          // AI 에러 응답 → 사용자에게 재입력 유도 (AI 창작물 노출 안 함)
          addLog("■ 고민을 한 문장으로 다시 던져라.", "system");
        } else {
          // 정상 경우 B — AI 질문 그대로 출력
          for (const line of aiText.split('\n')) {
            if (line.trim()) addLog(line, "system");
          }
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

  // 토큰 차감 헬퍼 — 해석 성공 후에만 호출
  const deductToken = async () => {
    try {
      const deductRes = await fetch('/api/tokens/deduct', { method: 'POST' });
      if (deductRes.ok) {
        const d = await deductRes.json();
        setTokenCount(d.balance);
        if (d.isAdmin !== undefined) setIsAdmin(d.isAdmin);
      } else if (deductRes.status === 402) {
        // 잔액 부족은 이미 해석이 성공한 이후 — 로그만 남기고 계속
        addLog("■ TOKEN_BALANCE: 0 — 다음 카드는 토큰을 충전 후 뽑을 수 있다.", "system");
      }
      // 401은 이미 해석 단계에서 차단됨
    } catch {
      setTokenCount(prev => Math.max(0, prev - 1));
    }
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

      const cardData = getCardById(drawn.id);
      const dirLabel = drawn.isReversed ? '[역방향]' : '[정방향]';
      addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
      addLog(`CARD #${String(drawn.id + 1).padStart(2, '0')} — ${cardData.nameKo} ${dirLabel}`, "system");
      addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
      await runDelay(200);

      // ── 해석 먼저, 성공 시 토큰 차감 ──────────────────────────

      // TIMING 모드: AI 해석 (숫자 힌트 포함)
      if (readingPlan?.type === 'TIMING') {
        const timingNum = getTimingNumber(drawn.id);
        const timingHint = timingNum === 0
          ? `이 카드의 숫자는 0 또는 무한대다. 선고 첫 줄을 반드시 "기약 없다." 또는 "때가 되면 온다." 형태로 시작하라.`
          : `이 카드의 숫자는 ${timingNum}이다. 질문 맥락을 보고 ${timingNum}일 / ${timingNum}주 / ${timingNum}개월 중 하나를 골라 선고 첫 줄을 반드시 "${timingNum}일이다." / "${timingNum}주다." / "${timingNum}개월이다." 형태로 시작하라. 숫자를 생략하거나 범위로 말하지 마라.`;
        addLog("✦ 오라클이 읽는다...", "system");
        let readingSucceeded = false;
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
              position: { name: '타이밍', question: '언제 가능한가' },
              questionContext: [readingSessionSummary, questionContext.join(' / ')].filter(Boolean).join('\n'),
              timingHint,
              readingType: readingPlan?.type,
              isOwner,
            }),
          });
          if (res.status === 401) {
            addLog("■ SESSION_EXPIRED — 세션이 만료되었다. 다시 로그인하라. (/logout 입력)", "system");
            setIsProcessing(false);
            return;
          }
          const readingData = await res.json();
          const reading: string = readingData.reading ?? '';
          const isNegativeReading: boolean = readingData.isNegative ?? drawn.isReversed;
          if (!reading) {
            addLog("■ 오라클 회선 불안정. 토큰은 차감되지 않았다. 잠시 후 다시 시도하라.", "system");
          } else {
            readingSucceeded = true;
            addLog(`✦ 타이밍`, "system");
            addLog(`   "언제 가능한가"`, "system");
            reading.split('\n').filter(l => l.trim()).forEach(line => addLog(line, "system"));
            const remainingDraws = 15 - (newSessionCount + 1);
            if (isNegativeReading && remainingDraws > 0) {
              addLog("대응 가능한 궤적이다. 개입 여지가 있다. [조언]", "system");
            }
            addLog("- - - - - - - - - - - - - - - -", "separator", false);
            accReadings = [...accReadings, {
              positionName: '타이밍', positionQuestion: '언제 가능한가',
              cardNum: drawn.id + 1, cardNameKo: cardData.nameKo,
              isReversed: drawn.isReversed, reading,
            }];
          }
        } catch {
          addLog("■ 오라클 회선 불안정. 토큰은 차감되지 않았다. 잠시 후 다시 시도하라.", "system");
        }
        if (readingSucceeded) {
          await deductToken();
          newSessionCount += 1;
          const latestReading = accReadings[accReadings.length - 1];
          const firstLine = latestReading.reading.split('\n').find(l => l.trim()) ?? '';
          setReadingSessionSummary(prev =>
            `${prev ? prev + '\n' : ''}[타이밍] ${questionContext.join(' ')} → ${cardData.nameKo}(${drawn.isReversed ? '역방향' : '정방향'}): ${firstLine}`
          );
        }
        await runDelay(300);
        continue;
      }

      // 일반 QUESTION / FLOW 해석
      addLog("✦ 오라클이 읽는다...", "system");
      let readingSucceeded = false;
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
            questionContext: [readingSessionSummary, questionContext.join(' / ')].filter(Boolean).join('\n'),
            readingType: readingPlan?.type,
          }),
        });
        if (res.status === 401) {
          addLog("■ SESSION_EXPIRED — 세션이 만료되었다. 다시 로그인하라. (/logout 입력)", "system");
          setIsProcessing(false);
          return;
        }
        const readingData = await res.json();
        const reading: string = readingData.reading ?? '';
        if (!reading) {
          addLog("■ 오라클 회선 불안정. 토큰은 차감되지 않았다. 잠시 후 다시 시도하라.", "system");
        } else {
          readingSucceeded = true;
          addLog(`✦ ${position.name}`, "system");
          addLog(`   "${position.question}"`, "system");
          reading.split('\n').filter(l => l.trim()).forEach(line => addLog(line, "system"));
          const isNegativeReading: boolean = readingData.isNegative ?? drawn.isReversed;
          const remainingDraws = 15 - (newSessionCount + 1);
          if (isNegativeReading && remainingDraws > 0) {
            addLog("대응 가능한 궤적이다. 개입 여지가 있다. [조언]", "system");
          }
          addLog("- - - - - - - - - - - - - - - -", "separator", false);
          accReadings = [...accReadings, {
            positionName: position.name,
            positionQuestion: position.question,
            cardNum: drawn.id + 1,
            cardNameKo: cardData.nameKo,
            isReversed: drawn.isReversed,
            reading,
          }];
        }
      } catch {
        addLog("■ 오라클 회선 불안정. 토큰은 차감되지 않았다. 잠시 후 다시 시도하라.", "system");
      }
      if (readingSucceeded) {
        await deductToken();
        newSessionCount += 1;
        const latestReading = accReadings[accReadings.length - 1];
        const firstLine = latestReading.reading.split('\n').find(l => l.trim()) ?? '';
        setReadingSessionSummary(prev =>
          `${prev ? prev + '\n' : ''}[${latestReading.positionName}] ${questionContext.join(' ')} → ${cardData.nameKo}(${drawn.isReversed ? '역방향' : '정방향'}): ${firstLine}`
        );
      }

      await runDelay(300);
    }

    // 상태 일괄 업데이트
    const newPendingIdx = pendingPositionIndex + deckIndices.length;
    setDrawnCards(accDrawn);
    setDeckIndex(Math.max(...deckIndices) + 1);
    setPendingPositionIndex(newPendingIdx);
    setSessionCount(newSessionCount);

    // 종합 해석: 모든 포지션이 채워졌고 카드가 2장 이상일 때
    const allPositionsFilled = newPendingIdx >= readingPlan.positions.length;
    if (allPositionsFilled && readingPlan.positions.length >= 2) {
      addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
      addLog("✦ 종합", "system");
      addLog("오라클이 전체를 읽는다...", "system");
      try {
        const synthRes = await fetch('/api/synthesis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            readings: accReadings,
            questionContext: questionContext.join(' / '),
            readingType: readingPlan.type,
          }),
        });
        const synthData = await synthRes.json();
        const synthesis: string = synthData.synthesis ?? '카드들은 모두 제 자리에 놓였다.';
        synthesis.split('\n').filter(l => l.trim()).forEach(line => addLog(line, "system"));
      } catch {
        addLog("■ 종합 회선 불안정.", "system");
      }
      addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
      await runDelay(300);
    }

    // 스냅샷 누적 업데이트 (꼬리질문 포함 모든 리딩 합산)
    const newSnapshotBlock = `[질문]\n${questionContext.join('\n')}\n\n` +
      accReadings.map(r =>
        `[${r.positionName}]\nCARD #${String(r.cardNum).padStart(2,'00')} — ${r.cardNameKo} ${r.isReversed ? '[역방향]' : '[정방향]'}\n${r.reading}`
      ).join('\n\n');
    setCopySnapshot(prev => prev ? `${prev}\n\n${'─'.repeat(28)}\n\n${newSnapshotBlock}` : newSnapshotBlock);

    // 리딩 기록 저장 (본인 리딩만 — 타인 리딩은 프라이버시 보호로 저장 안 함)
    if (allPositionsFilled && isOwner) {
      fetch('/api/readings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: questionContext.join(' / '),
          readingType: readingPlan.type,
          cards: accReadings.map(r => ({
            positionName: r.positionName,
            cardNameKo: r.cardNameKo,
            cardNum: r.cardNum,
            isReversed: r.isReversed,
            reading: r.reading,
          })),
          readingContent: newSnapshotBlock,
        }),
      }).catch(() => {/* 저장 실패는 무시 */});
    }

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
      // 꼬리질문: context·plan 리셋 (cardReadings는 다음 뽑기 시작 시 초기화)
      // 주제 감지를 위해 현재 컨텍스트를 저장한 뒤 초기화
      setPrevTopicContext(questionContext.join(' '));
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
    setReadingSessionSummary('');
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
    addLog("■ 결제 시스템은 현재 점검 중이다.", "system");
    addLog("곧 열린다. 조금만 기다려라.", "system");
    addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
    addLog("[Q] 질문   [T] 토큰   [B] 가방", "system");
    setStep('main');
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
    triggerSkipTyping();

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
      setReadingSessionSummary('');
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
    const authSteps: FlowStep[] = ['boot', 'login', 'login_email', 'login_email_type', 'login_email_pw'];
    if (!authSteps.includes(step) && isTokenIntent(input)) {
      addLog(input.trim(), 'user');
      setShopReturnStep(step);
      await showTokenShop();
      return;
    }
  if (input === '__advice__') {
  addLog("조언을 구한다.", 'user');
  addLog("어떤 방향의 조언이 필요한가. 구체적으로 입력하라.", "system");
  if (step !== 'ask_question') setStep('ask_question');
  return;
}
    // /menu — 어느 단계에서든 메인으로 복귀 (인증 전·메인 제외)
    const menuSteps: FlowStep[] = [...authSteps, 'main'];
    const isMenuIntent = (s: string) => /^\/menu$|^\/main$|^\/back$/i.test(s.trim());
    if (!menuSteps.includes(step) && isMenuIntent(input)) {
      addLog(input.trim(), 'user');
      addLog("■ 메인으로 돌아간다.", "system");
      await runDelay(300);
      setQuestionContext([]);
      setReadingPlan(null);
      setQuestionAttempts(0);
      setCardReadings([]);
      addLog("- - - - - - - - - - - - - - - -", "separator");
      addLog("[Q] 질문   [T] 토큰   [B] 가방", "system");
      setStep('main');
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

    // login_email — 이메일 입력
    if (step === 'login_email') {
      if (input === '') return;
      addLog(input, 'user');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.trim())) {
        addLog("■ 올바른 이메일 형식이 아니다.", "system");
        return;
      }
      setPendingEmail(input.trim());
      addLog("신규 가입: N   로그인: Y", "system");
      setStep('login_email_type');
      return;
    }

    // login_email_type — 신규/로그인 선택
    if (step === 'login_email_type') {
      if (input === '') return;
      addLog(input, 'user');
      if (isYes(input)) {
        setLoginMode('login');
        addLog("비밀번호를 입력하라.", "system");
        setStep('login_email_pw');
      } else if (isNo(input)) {
        setLoginMode('signup');
        addLog("비밀번호를 설정하라. (8자 이상)", "system");
        setStep('login_email_pw');
      } else {
        addLog("■ Y: 로그인   N: 신규 가입", "system");
      }
      return;
    }

    // login_email_pw — 비밀번호 입력
    if (step === 'login_email_pw') {
      if (input === '') return;
      addLog('••••••••', 'user');
      processEmailPassword(input);
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
        // QUESTION 선택 — 예시 텍스트를 질문으로 확정, 바로 분석
        const confirmed = choiceTexts?.opt1 || '';
        if (confirmed) {
          addLog(`■ 확정: ${confirmed}`, "system");
          const ctx = [...questionContext, `[모드 확정: QUESTION] ${confirmed}`];
          setQuestionContext(ctx);
          await processAnalysis(ctx, isOwner);
        } else {
          addLog("■ [QUESTION 모드] 구체적인 질문으로 전환한다.", "system");
          addLog("어떤 질문으로 볼 것인가? 한 문장으로 명확히 입력하라.", "system");
          setQuestionContext(prev => [...prev, '[모드 확정: QUESTION — 구체적 질문으로 포지션 설계하라]']);
          setStep('ask_question');
        }
        return;
      }
      if (trimmed === '2') {
        // FLOW 선택 — 예시 텍스트에서 기간 파싱 시도, 있으면 바로 확정
        const opt2 = choiceTexts?.opt2 || '';
        const numM = opt2.match(/(\d+)\s*(개월|주|일)/);
        if (numM) {
          const n = Math.min(12, Math.max(1, parseInt(numM[1])));
          const rawUnit = numM[2];
          const unit: '일' | '주' | '월' = rawUnit === '개월' ? '월' : rawUnit === '주' ? '주' : '일';
          addLog(`■ 확정: ${opt2}`, "system");
          const positions = Array.from({ length: n }, (_, i) => ({
            name: `${unit}${i + 1}`,
            question: `${i + 1}${unit}차의 흐름`,
          }));
          const plan: ReadingPlan = { type: 'FLOW', cardCount: n, timeUnit: unit, positions };
          setReadingPlan(plan);
          addLog(`>> 설정 확정: ${n}장 / ${unit}단위`, "system");
          await runDelay(300);
          const { deck: reshuffled, attempts } = shuffleDeckWithAlignment(createFreshDeck());
          setCurrentDeck(reshuffled);
          setDeckIndex(0);
          setDrawnCards([]);
          setCardReadings([]);
          setDrawnDeckIndices(new Set());
          setDrawnCardIds(new Set());
          setShuffleTopCard(reshuffled[0]);
          await waitForShuffleAnimation();
          await logAlignmentAttempts(attempts);
          addLog("덱 초기화 완료. 카드를 고르라.", "system");
          addLog(`POSITION_01 ║ ${positions[0].name} — "${positions[0].question}"`, "system");
          setStep('card_draw');
        } else {
          // 기간 파싱 실패 → 입력 받기
          addLog("■ [FLOW 모드] 흐름 리딩으로 전환한다.", "system");
          if (opt2) addLog(`참고: ${opt2}`, "system");
          addLog("기간을 입력하라. (예: 3개월, 6주, 30일)", "system");
          setStep('ask_flow_period');
        }
        return;
      }
      if (trimmed === '3') {
        // 다른 질문 → 전체 초기화 후 재입력
        addLog("■ 다른 질문을 입력하라.", "system");
        setQuestionContext([]);
        setQuestionAttempts(0);
        setChoiceTexts(null);
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
      // 새 세션 첫 질문 — pre-analysis부터
      await processPreAnalysis(newContext);
      return;
    }

    // 빈 입력(엔터)은 confirm 계열 스텝에서만 허용 (Y로 처리)
    const confirmSteps: FlowStep[] = ['confirm_plan', 'confirm_flow_config', 'confirm_context', 'confirm_identity', 'ask_flow_period', 'login'];
    if (input === '' && !confirmSteps.includes(step)) return;
    addLog(input, 'user');

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
      const isBagIntent = (s: string) => {
        const t = s.trim().toUpperCase();
        if (['B', 'ㅠ', '가방', '/BAG', '/bag'].includes(t)) return true;
        return /가방|히스토리|기록|내역|과거|이전/.test(s.trim());
      };
      if (isQuestionIntent(input)) {
        setIsProcessing(true);
        addLog("무엇을 알고 싶은가.", "system");
        await runDelay(400);
        addLog("마녀의 카드는 들을 준비가 되었다.", "system");
        addLog("(/menu 입력 시 언제든 메인으로 돌아갈 수 있다.)", "system");
        setQuestionContext([]);
        setStep('ask_question');
        setIsProcessing(false);
      } else if (isBagIntent(input)) {
        setIsProcessing(true);
        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
        addLog("▶ 가방을 연다.", "system");
        await runDelay(300);
        try {
          const res = await fetch('/api/bag');
          if (res.status === 401) {
            addLog("■ 세션이 만료되었다. /logout 후 재로그인하라.", "system");
          } else {
            const data = await res.json();

            // ── 토큰 잔액 ─────────────────────────────────
            const balance: number = data.tokenBalance ?? 0;
            const adminFlag: boolean = data.isAdmin ?? false;
            addLog(`TOKEN_BALANCE :: ${adminFlag ? '∞' : balance}`, "system");
            addLog("", "system", false);

            // ── 리딩 기록 ─────────────────────────────────
            const readings: Array<{
              id: string;
              created_at: string;
              question_text: string;
              reading_type: string;
              cards: Array<{ cardNameKo: string; isReversed: boolean }>;
              synthesis?: string;
            }> = data.readings ?? [];

            addLog("[ READING HISTORY ]", "system");
            if (readings.length === 0) {
              addLog("  기록 없음.", "system");
            } else {
              addLog(`  최근 ${readings.length}건`, "system");
              addLog("", "system", false);
              readings.forEach((r, i) => {
                const d = new Date(r.created_at);
                const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                addLog(`  [${String(i+1).padStart(2,'0')}] ${dateStr}  ${r.reading_type}`, "system");
                addLog(`       Q: ${r.question_text.slice(0, 38)}${r.question_text.length > 38 ? '...' : ''}`, "system");
                const cardNames = r.cards
                  .map((c: { cardNameKo: string; isReversed: boolean }) => `${c.cardNameKo}${c.isReversed ? '(역)' : ''}`)
                  .join(' · ');
                addLog(`       ♦ ${cardNames}`, "system");
                if (r.synthesis) {
                  addLog(`       ✦ ${r.synthesis.split('\n')[0].slice(0, 48)}`, "system");
                }
                if (i < readings.length - 1) addLog("", "system", false);
              });
            }
            addLog("", "system", false);

            // ── 결제 내역 ─────────────────────────────────
            const payments: Array<{
              id: string;
              created_at: string;
              amount: number;
              tokens_added: number;
              package_name: string;
            }> = data.payments ?? [];

            addLog("[ PAYMENT HISTORY ]", "system");
            if (payments.length === 0) {
              addLog("  결제 내역 없음.", "system");
            } else {
              payments.forEach((p, i) => {
                const d = new Date(p.created_at);
                const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                addLog(`  [${String(i+1).padStart(2,'0')}] ${dateStr}`, "system");
                addLog(`       ${p.package_name}  ${p.amount.toLocaleString()}원  +${p.tokens_added}토큰`, "system");
                if (i < payments.length - 1) addLog("", "system", false);
              });
            }
            addLog("", "system", false);
            addLog("  ※ 결제 내역은 3년간 보관 후 자동 삭제된다.", "system");
          }
        } catch {
          addLog("■ 기록 회선 불안정.", "system");
        }
        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
        setStep('main');
        setIsProcessing(false);
      } else {
        addLog("■ 알 수 없는 입력. [Q] [T] [B] 중 하나를 입력하라.", "system");
      }
      return;
    }

    // confirm_end_session — 세션 종료 확인
    if (step === 'confirm_end_session') {
      addLog(input, 'user');
      if (isYes(input)) {
        addLog("세션을 종료한다.", "system");
        await runDelay(300);
        addLog("- - - - - - - - - - - - - - - -", "separator");
        addLog("[Q] 질문   [T] 토큰   [B] 가방", "system");
        setStep('main');
      } else {
        addLog("꼬리질문을 입력하라.", "system");
        setStep('ask_question');
      }
      return;
    }

    // ask_question — 꼬리질문이거나 이미 본인/타인 확인됐으면 바로 분석
    if (step === 'ask_question') {
      // 결론 재요청 감지 — 이미 리딩이 있고 결론/요약을 묻는 경우 새 카드 없이 정리
      const isConcludeIntent = (s: string) =>
        /결론|그래서 뭐|그래서뭐|어쩌라|어쩌란|핵심이 뭐|한마디로|요약|정리해|정리 해|뭐가 답|뭐야 결국|결국 뭐|결국엔/.test(s);

      // 꼬리질문 없음 감지 — 리딩 완료 후 종료 의사 표현 시 세션 종료 확인
      const isNoFollowUp = (s: string) =>
        /^(없어|없음|없다|괜찮아|괜찮음|됐어|됐다|그만|끝|아니|아니오|노|ㄴ|ㄴㄴ|no)$/i.test(s.trim());

      if (isNoFollowUp(input) && sessionCount > 0 && questionContext.length === 0) {
        addLog("세션을 종료하겠는가?", "system");
        addLog("[Y] 메인으로   [N] 꼬리질문 입력", "system");
        setStep('confirm_end_session');
        return;
      }

      if (isConcludeIntent(input) && readingSessionSummary) {
        setIsProcessing(true);
        addLog("■ 카드가 이미 말했다. 다시 정리한다.", "system");
        try {
          const res = await fetch('/api/conclude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionSummary: readingSessionSummary,
              questionContext: questionContext.join(' '),
            }),
          });
          const data = await res.json();
          const conclusion: string = data.conclusion ?? '카드는 이미 말했다.';
          addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
          conclusion.split('\n').filter(l => l.trim()).forEach(line => addLog(line, "system"));
          addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
        } catch {
          addLog("■ 오라클 회선 불안정.", "system");
        }
        setIsProcessing(false);
        return;
      }

      // 주제 일관성 감지: 이전 리딩이 있고(sessionCount > 0), 새 질문이 시작되는 시점(questionContext 비어있음)에만 체크
      // 명시적 새 주제 의도 OR 카테고리가 다른 주제로 판단될 때 확인 요청
      const updated = [...questionContext, input];
      setQuestionContext(updated);
      const isFollowUp = questionContext.length > 0;
      if (isFollowUp || identityConfirmed) {
        // 꼬리질문 or 이미 확인됨 → 본인/타인 재확인 없이 바로 분석
        await processAnalysis(updated, isOwner);
      } else {
        // 첫 질문 — 모호성 먼저 판단 후 본인/타인 묻기
        await processPreAnalysis(updated);
      }
    }

    // confirm_new_topic — 새 주제 전환 확인 (AI가 NEW_SPREAD 판단 후 진입)
    if (step === 'confirm_new_topic') {
      addLog(input, 'user');
      if (isYes(input)) {
        // 전체 리셋 후 저장된 질문으로 바로 진행 (재입력 불필요)
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
        setPrevTopicContext('');
        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "system", false);
        addLog("■ 덱을 초기화한다.", "system");
        if (pendingReshuffleCtx) {
          const newCtx = [pendingReshuffleCtx.context[pendingReshuffleCtx.context.length - 1]];
          setQuestionContext(newCtx);
          setPendingReshuffleCtx(null);
          // skipNewSpreadCheck=true: 방금 리셋했으므로 NEW_SPREAD 재감지 불필요
          await processAnalysis(newCtx, pendingReshuffleCtx.ownerFlag, true);
        } else {
          setQuestionContext([]);
          setStep('ask_question');
        }
      } else if (isNo(input)) {
        // 현재 덱 유지 — 저장된 질문을 꼬리질문으로 처리
        addLog("■ 현재 이야기를 계속한다.", "system");
        if (pendingReshuffleCtx) {
          const ctx = pendingReshuffleCtx.context;
          setQuestionContext(ctx);
          setPendingReshuffleCtx(null);
          await processAnalysis(ctx, pendingReshuffleCtx.ownerFlag, true);
        } else {
          setStep('ask_question');
        }
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
        addLog("■ [Y] 본인   [N] 타인 — 다시 입력하라.", "system");
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
        className="shrink-0 pb-2 mb-1"
        style={{
          fontFamily: 'var(--font-roboto-mono), var(--font-noto-sans-kr), "Courier New", monospace',
          fontSize: '13px',
          lineHeight: 1,
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

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
        <div className="pt-4">
          <LogDisplay logs={logs} skipTyping={skipTyping} onTap={(val) => { triggerSkipTyping(); if (!isProcessing) handleUserInput(val); }} />
        </div>

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
       {(step === 'login' || step === 'confirm_identity') && !isProcessing && (
         <MenuSelector
         options={currentOptions}
         selectedIndex={menuIndex}
         onSelect={(opt) => {
          if (step === 'login') {
             addLog(opt, 'user');
              processLoginFlow(opt);
             } else {
              handleUserInput(opt);
      }
    }}
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
            allowEmpty={(['confirm_plan', 'confirm_flow_config', 'confirm_context', 'confirm_identity', 'ask_flow_period', 'confirm_new_topic', 'token_shop_confirm', 'login', 'confirm_end_session'] as FlowStep[]).includes(step)}
          />
        </div>
      )}
    </div>
  );
}
