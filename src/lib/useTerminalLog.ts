import { useState, useEffect } from 'react';

export type LogType = {
  id: string;
  text: string;
  type: 'system' | 'user' | 'separator' | 'witch';
  isTyping?: boolean;
};

// sessionStorage: 탭/브라우저 닫으면 초기화 → 새 방문은 항상 fresh
// OAuth 리다이렉트 복귀(같은 탭)는 sessionStorage가 살아있어서 로그 복원 가능
const STORAGE_KEY = 'coded_tarot_log';

export function useTerminalLog() {
  const [logs, setLogs] = useState<LogType[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') { setIsLoaded(true); return; }

    const navEntries = performance.getEntriesByType('navigation');
    const navType = navEntries.length > 0
      ? (navEntries[0] as PerformanceNavigationTiming).type
      : 'navigate';

    if (navType === 'reload') {
      // 새로고침: 로그 초기화
      sessionStorage.removeItem(STORAGE_KEY);
      setLogs([]);
    } else {
      // OAuth 복귀(navigate): sessionStorage에 있으면 복원
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved).map((log: LogType) => ({ ...log, isTyping: false }));
          setLogs(parsed);
        } catch {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    }
    setIsLoaded(true);
  }, []);

  // 로그 변경 시 sessionStorage에 저장
  useEffect(() => {
    if (isLoaded && logs.length > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    }
  }, [logs, isLoaded]);

  const addLog = (text: string, type: LogType['type'], animate = true) => {
    setLogs(prev => [...prev, {
      id: crypto.randomUUID(),
      text,
      type,
      isTyping: (type === 'system' || type === 'witch') && animate
    }]);
  };

  const clearLogs = () => {
    setLogs([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return { logs, addLog, setLogs, clearLogs, isLoaded };
}
