import { useEffect, useRef, useState } from 'react';
import { LogType } from '@/lib/useTerminalLog';

const TERMINAL_FONT = 'var(--font-roboto-mono), var(--font-noto-sans-kr), "Courier New", monospace';

const GLITCH_CHARS = '▓█░▒│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌▄▀■□▪▫';

// CSS 애니메이션 주입 (한 번만)
const WITCH_STYLE = `
@keyframes witch-flicker {
  0%,90%,100% { opacity:1; }
  91% { opacity:0.65; }
  93% { opacity:1; }
  95% { opacity:0.3; }
  97% { opacity:1; }
}
@keyframes witch-shake {
  0%,100% { transform:translate(0,0); }
  15% { transform:translate(-0.6px, 0.4px); }
  30% { transform:translate(0.6px,-0.4px); }
  45% { transform:translate(-0.4px,-0.6px); }
  60% { transform:translate(0.4px, 0.6px); }
  75% { transform:translate(-0.3px, 0.3px); }
}
.witch-log {
  color: #00FF41;
  text-shadow:
    0 0 4px #00FF41,
    0 0 10px rgba(0,255,65,0.5),
    0 0 20px rgba(0,255,65,0.2);
  animation:
    witch-flicker 3.5s infinite,
    witch-shake 0.09s infinite;
  display: block;
}
.witch-dead {
  color: #3a3a3a;
  text-shadow: none;
  animation: none;
  opacity: 0.6;
  display: block;
}
`;

function injectWitchStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('witch-style')) return;
  const el = document.createElement('style');
  el.id = 'witch-style';
  el.textContent = WITCH_STYLE;
  document.head.appendChild(el);
}

// ─── 클릭 가능 파서 ───────────────────────────────────────────
type Segment = { text: string; clickValue?: string };

function parseClickable(text: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;

  while (i < text.length) {
    const rest = text.slice(i);

    // [조언] — 한국어 특수 버튼
    const adviceM = rest.match(/^\[조언\]/);
    if (adviceM) {
      // 클릭 시 echo는 기계톤(>> REQ: 조언). 센티넬로 전달하고 Terminal에서 치환·처리
      segments.push({ text: adviceM[0], clickValue: '__ADVICE_REQ__' });
      i += adviceM[0].length;
      continue;
    }

    // [재생 NN] — 가방 기록 재생
    const replayM = rest.match(/^\[재생\s+(\d+)\]/);
    if (replayM) {
      segments.push({ text: replayM[0], clickValue: `/replay ${parseInt(replayM[1], 10)}` });
      i += replayM[0].length;
      continue;
    }

    // [종료] — 재생 종료 후 가방으로 복귀
    const endM = rest.match(/^\[종료\]/);
    if (endM) {
      segments.push({ text: endM[0], clickValue: '/bag' });
      i += endM[0].length;
      continue;
    }

    // [기록] / [질문 내역] / [목록으로 돌아가기] — 기록 목록으로
    const recordM = rest.match(/^\[기록\]/);
    if (recordM) {
      segments.push({ text: recordM[0], clickValue: '/history' });
      i += recordM[0].length;
      continue;
    }
    const backListM = rest.match(/^\[목록으로 돌아가기\]/);
    if (backListM) {
      segments.push({ text: backListM[0], clickValue: '/history' });
      i += backListM[0].length;
      continue;
    }
    const backBagM = rest.match(/^\[가방으로 돌아가기\]/);
    if (backBagM) {
      segments.push({ text: backBagM[0], clickValue: '/bag' });
      i += backBagM[0].length;
      continue;
    }
    // 법적 고지 — 가방/푸터에서 문서 열기
    const termsM = rest.match(/^\[이용약관\]/);
    if (termsM) {
      segments.push({ text: termsM[0], clickValue: '/terms' });
      i += termsM[0].length;
      continue;
    }
    const privacyM = rest.match(/^\[개인정보처리방침\]/);
    if (privacyM) {
      segments.push({ text: privacyM[0], clickValue: '/privacy' });
      i += privacyM[0].length;
      continue;
    }
    const refundM = rest.match(/^\[청약철회정책\]/);
    if (refundM) {
      segments.push({ text: refundM[0], clickValue: '/refund' });
      i += refundM[0].length;
      continue;
    }
    // [제거] / [추출] — 재생 후 기록 조작
    const removeM = rest.match(/^\[제거\]/);
    if (removeM) {
      segments.push({ text: removeM[0], clickValue: '/remove' });
      i += removeM[0].length;
      continue;
    }
    const extractM = rest.match(/^\[추출\]/);
    if (extractM) {
      segments.push({ text: extractM[0], clickValue: '/extract' });
      i += extractM[0].length;
      continue;
    }
    // [질문 내역] / [결제 내역] — 가방 하위 메뉴
    const historyM = rest.match(/^\[질문 내역\]/);
    if (historyM) {
      segments.push({ text: historyM[0], clickValue: '/history' });
      i += historyM[0].length;
      continue;
    }
    const payHistM = rest.match(/^\[결제 내역\]/);
    if (payHistM) {
      segments.push({ text: payHistM[0], clickValue: '/payments' });
      i += payHistM[0].length;
      continue;
    }
    const menuM = rest.match(/^\[메뉴\]/);
    if (menuM) {
      segments.push({ text: menuM[0], clickValue: '__MENU__' });
      i += menuM[0].length;
      continue;
    }
    // [돌아가기] — 가방 화면에서 메인(QTB)으로
    const backMenuM = rest.match(/^\[돌아가기\]/);
    if (backMenuM) {
      segments.push({ text: backMenuM[0], clickValue: '__MENU__' });
      i += backMenuM[0].length;
      continue;
    }
    // [입력 완료] — 카톡식 멀티라인 질문 작성 마무리
    const composeDoneM = rest.match(/^\[입력 완료\]/);
    if (composeDoneM) {
      segments.push({ text: composeDoneM[0], clickValue: '__COMPOSE_DONE__' });
      i += composeDoneM[0].length;
      continue;
    }

    const enterM = rest.match(/^\[엔터\](?:\/Y)?/);
    if (enterM) {
      segments.push({ text: enterM[0], clickValue: '' });
      i += enterM[0].length;
      continue;
    }

    const bracketLabelM = rest.match(/^(\[[A-Z]\])\s+([가-힣]+)/);
    if (bracketLabelM) {
      const key = bracketLabelM[1][1];
      segments.push({ text: bracketLabelM[0], clickValue: key });
      i += bracketLabelM[0].length;
      continue;
    }

    // [1] [2] [3] — 숫자 대괄호 (토큰 충전 패키지 등) 터치 선택
    const bracketDigitM = rest.match(/^\[([1-9])\]/);
    if (bracketDigitM) {
      segments.push({ text: bracketDigitM[0], clickValue: bracketDigitM[1] });
      i += bracketDigitM[0].length;
      continue;
    }

    const bracketM = rest.match(/^\[[A-Z]\]/);
    if (bracketM) {
      const key = bracketM[0][1];
      segments.push({ text: bracketM[0], clickValue: key });
      i += bracketM[0].length;
      continue;
    }

    const numDotM = rest.match(/^([1-9]\.) /);
    const prevIsSpace = i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n';
    if (numDotM && prevIsSpace) {
      segments.push({ text: numDotM[1], clickValue: numDotM[1][0] });
      i += numDotM[1].length;
      continue;
    }

    const last = segments[segments.length - 1];
    if (last && !('clickValue' in last)) {
      last.text += text[i];
    } else {
      segments.push({ text: text[i] });
    }
    i++;
  }

  return segments;
}

// ─── LogDisplay ──────────────────────────────────────────────
export default function LogDisplay({
  logs,
  onTap,
  skipTyping,
}: {
  logs: LogType[];
  onTap?: (val: string) => void;
  skipTyping?: boolean;
}) {
  useEffect(() => { injectWitchStyle(); }, []);

  return (
    <div
      className="flex flex-col gap-1 terminal-text"
      style={{ fontFamily: TERMINAL_FONT, fontSize: '16px', lineHeight: '1.8' }}
    >
      {logs.map((log) => (
        <LogItem key={log.id} log={log} onTap={onTap} skipTyping={skipTyping} />
      ))}
    </div>
  );
}

// ─── WitchLogItem ─────────────────────────────────────────────
function WitchLogItem({
  log,
  skipTyping,
}: {
  log: LogType;
  skipTyping?: boolean;
}) {
  const [displayedText, setDisplayedText] = useState(log.isTyping ? '' : log.text);
  const [done, setDone] = useState(!log.isTyping);
  const [glitched, setGlitched] = useState('');
  const glitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 타이핑 — 마녀 독백은 약간 더 느리게 (20ms)
  useEffect(() => {
    if (!log.isTyping) return;
    let index = 0;
    const interval = setInterval(() => {
      // 타이핑 중 간헐적으로 글리치 문자 섞기
      const char = log.text[index];
      const showGlitch = char && char !== ' ' && Math.random() < 0.06;
      setDisplayedText(
        log.text.slice(0, index) +
        (showGlitch ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)] : char)
      );
      setTimeout(() => setDisplayedText(log.text.slice(0, index + 1)), 40);
      index++;
      if (index >= log.text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 20);
    return () => clearInterval(interval);
  }, [log]);

  // 스킵
  useEffect(() => {
    if (skipTyping && log.isTyping && !done) {
      setDisplayedText(log.text);
      setDone(true);
    }
  }, [skipTyping]);

  // 완료 후 간헐적 글리치 (2~5초마다) — 발광이 꺼지면(dead) 중단
  useEffect(() => {
    if (!done || log.dead) { setGlitched(''); return; }
    const schedule = () => {
      glitchTimer.current = setTimeout(() => {
        // 1~2글자 깨뜨리기
        const arr = log.text.split('');
        const numGlitch = Math.floor(Math.random() * 2) + 1;
        for (let k = 0; k < numGlitch; k++) {
          const idx = Math.floor(Math.random() * arr.length);
          if (arr[idx] !== ' ') {
            arr[idx] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
          }
        }
        setGlitched(arr.join(''));
        setTimeout(() => {
          setGlitched('');
          schedule();
        }, 60 + Math.random() * 80);
      }, 2000 + Math.random() * 3500);
    };
    schedule();
    return () => { if (glitchTimer.current) clearTimeout(glitchTimer.current); };
  }, [done, log.text, log.dead]);

  return (
    <span className={log.dead ? 'witch-dead' : 'witch-log'} style={{ fontFamily: TERMINAL_FONT, fontSize: '16px', lineHeight: '1.8', whiteSpace: 'pre-wrap', textDecoration: log.struck ? 'line-through' : undefined }}>
      {log.dead ? log.text : (glitched || displayedText)}
    </span>
  );
}

// ─── LogItem ─────────────────────────────────────────────────
function LogItem({
  log,
  onTap,
  skipTyping,
}: {
  log: LogType;
  onTap?: (val: string) => void;
  skipTyping?: boolean;
}) {
  // 마녀 독백 전용 렌더러
  if (log.type === 'witch') {
    return <WitchLogItem log={log} skipTyping={skipTyping} />;
  }

  const [displayedText, setDisplayedText] = useState(log.isTyping ? '' : log.text);
  const [done, setDone] = useState(!log.isTyping);

  useEffect(() => {
    if (!log.isTyping) return;
    let index = 0;
    const interval = setInterval(() => {
      setDisplayedText(log.text.slice(0, index + 1));
      index++;
      if (index >= log.text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [log]);

  useEffect(() => {
    if (skipTyping && log.isTyping && !done) {
      setDisplayedText(log.text);
      setDone(true);
    }
  }, [skipTyping]);

  const colorClass = 'text-[#00FF41]';
  const prefix = log.type === 'user' ? '> ' : '';

  if (log.type === 'user' || !done || !onTap) {
    return (
      <div className={`${colorClass} break-words whitespace-pre-wrap`}>
        {prefix}{displayedText}
      </div>
    );
  }

  const segments = parseClickable(displayedText);
  const hasClickable = segments.some(s => 'clickValue' in s);

  if (!hasClickable) {
    return (
      <div className={`${colorClass} break-words whitespace-pre-wrap`}>
        {displayedText}
      </div>
    );
  }

  return (
    <div className={`${colorClass} break-words whitespace-pre-wrap`}>
      {segments.map((seg, i) =>
        'clickValue' in seg ? (
          <button
            key={i}
            // 탭 시 입력창 포커스를 뺏지 않게 한다 → 키보드가 닫혔다 열리는 깜빡임·화면 밀림 방지.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onTap(seg.clickValue!)}
            style={{
              fontFamily: TERMINAL_FONT,
              fontSize: 'inherit',
              color: '#00FF41',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontWeight: 'bold',
              textDecoration: 'underline',
              lineHeight: 'inherit',
            }}
          >
            {seg.text}
          </button>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </div>
  );
}
