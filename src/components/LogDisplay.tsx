import { useEffect, useState } from 'react';
import { LogType } from '@/lib/useTerminalLog';

export default function LogDisplay({ logs }: { logs: LogType[] }) {
  return (
    <div className="flex flex-col gap-1 terminal-text text-[16px] leading-[1.8]">
      {logs.map((log) => (
        <LogItem key={log.id} log={log} />
      ))}
    </div>
  );
}

function LogItem({ log }: { log: LogType }) {
  const [displayedText, setDisplayedText] = useState(log.isTyping ? '' : log.text);

  useEffect(() => {
    if (!log.isTyping) return;

    let index = 0;
    const interval = setInterval(() => {
      setDisplayedText(log.text.slice(0, index + 1));
      index++;
      if (index >= log.text.length) {
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [log]);

  // 🌟 시스템이든 유저든 모두 초록색 텍스트로 통일
  const colorClass = 'text-[#00FF41]';
  
  return (
    <div className={`${colorClass} break-words whitespace-pre-wrap`}>
      {log.type === 'user' ? `> ${displayedText}` : displayedText}
    </div>
  );
}