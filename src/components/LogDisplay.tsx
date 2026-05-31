import { useEffect, useState } from 'react';
import { LogType } from '@/lib/useTerminalLog';

const TERMINAL_FONT = 'var(--font-roboto-mono), var(--font-noto-sans-kr), "Courier New", monospace';

// ─── 클릭 가능 파서 ───────────────────────────────────────────
type Segment = { text: string; clickValue?: string };

function parseClickable(text: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;

  while (i < text.length) {
    const rest = text.slice(i);

    // 1. [엔터]/Y 또는 [엔터]
    const enterM = rest.match(/^\[엔터\](?:\/Y)?/);
    if (enterM) {
      segments.push({ text: enterM[0], clickValue: '' });
      i += enterM[0].length;
      continue;
    }

    // 2. [X] 한글라벨 — 브라켓 + 공백 + 한글 단어 전체를 하나의 버튼으로
    //    ex) [Q] 질문  [T] 토큰  [B] 가방  [Y] 본인  [N] 타인
    const bracketLabelM = rest.match(/^(\[[A-Z]\])\s+([가-힣]+)/);
    if (bracketLabelM) {
      const key = bracketLabelM[1][1]; // 브라켓 안의 알파벳
      segments.push({ text: bracketLabelM[0], clickValue: key });
      i += bracketLabelM[0].length;
      continue;
    }

    // 3. [X] 브라켓 단독
    const bracketM = rest.match(/^\[[A-Z]\]/);
    if (bracketM) {
      const key = bracketM[0][1];
      segments.push({ text: bracketM[0], clickValue: key });
      i += bracketM[0].length;
      continue;
    }

    // 4. N. 숫자+점 (번호 선택지 — 숫자+점만 클릭, 뒤 텍스트는 plain)
    //    "1. 질문" → [1.][질문]
    //    줄 맨 앞(i===0 또는 직전이 공백)이고 뒤에 공백이 오는 경우만 선택지로 인식
    const numDotM = rest.match(/^([1-9]\.) /);
    const prevIsSpace = i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n';
    if (numDotM && prevIsSpace) {
      // 숫자+점만 버튼, 뒤 공백은 plain으로
      segments.push({ text: numDotM[1], clickValue: numDotM[1][0] });
      i += numDotM[1].length;
      continue;
    }

    // 5. 나머지 — 이전 비클릭 세그먼트에 합치기
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
}: {
  logs: LogType[];
  onTap?: (val: string) => void;
}) {
  return (
    <div
      className="flex flex-col gap-1 terminal-text"
      style={{ fontFamily: TERMINAL_FONT, fontSize: '16px', lineHeight: '1.8' }}
    >
      {logs.map((log) => (
        <LogItem key={log.id} log={log} onTap={onTap} />
      ))}
    </div>
  );
}

// ─── LogItem ─────────────────────────────────────────────────
function LogItem({ log, onTap }: { log: LogType; onTap?: (val: string) => void }) {
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

  const colorClass = 'text-[#00FF41]';
  const prefix = log.type === 'user' ? '> ' : '';

  // 유저 입력 or 타이핑 중이면 plain 출력
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
