import { useEffect, useState } from 'react';
import { LogType } from '@/lib/useTerminalLog';

const TERMINAL_FONT = 'var(--font-roboto-mono), var(--font-noto-sans-kr), "Courier New", monospace';

// ─── 클릭 가능 파서 ───────────────────────────────────────────
type Segment = { text: string; clickValue?: string };

const BRACKET_MAP: Record<string, string> = {
  '[엔터]': '', '[엔터]/Y': '', '[Y]': 'Y', '[N]': 'N',
  '[Q]': 'Q', '[T]': 'T',
};
const WORD_CLICK = new Set(['Y', 'N', 'Q', 'T', '1', '2', '3']);

function parseClickable(text: string): Segment[] {
  const segments: Segment[] = [];
  // 순서: 브라켓 → 단어토큰 → 구분자
  const re = /(\[엔터\](?:\/Y)?|\[[YNQT]\]|[가-힣A-Za-z0-9]+|[^가-힣A-Za-z0-9\[\]]+|\[)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const tok = m[0];
    if (tok in BRACKET_MAP) {
      segments.push({ text: tok, clickValue: BRACKET_MAP[tok] });
    } else if (WORD_CLICK.has(tok)) {
      segments.push({ text: tok, clickValue: tok });
    } else {
      // 인접 비클릭 세그먼트와 합치기
      const last = segments[segments.length - 1];
      if (last && !('clickValue' in last)) {
        last.text += tok;
      } else {
        segments.push({ text: tok });
      }
    }
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

  // 유저 입력 or 타이핑 중이면 버튼 없이 plain 출력
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
