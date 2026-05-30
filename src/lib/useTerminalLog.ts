import { useState, useEffect } from 'react';

export type LogType = {
  id: string;
  text: string;
  type: 'system' | 'user' | 'separator';
  isTyping?: boolean;
};

const STORAGE_KEY = 'coded_tarot_log';

export function useTerminalLog() {
  const [logs, setLogs] = useState<LogType[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isReload = false;
    
    // 브라우저 환경에서 현재 접속이 '새로고침'으로 인한 것인지 확인
    if (typeof window !== 'undefined') {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0) {
        const navType = (navEntries[0] as PerformanceNavigationTiming).type;
        if (navType === 'reload') {
          isReload = true;
        }
      }
    }

    if (isReload) {
      // 새로고침을 했다면 로그를 완전히 날려버림
      localStorage.removeItem(STORAGE_KEY);
      setLogs([]);
    } else {
      // 외부 사이트(로그인 등)에서 돌아왔거나, 그냥 들어왔을 때 기존 세션 복원
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved).map((log: LogType) => ({ ...log, isTyping: false }));
        setLogs(parsed);
      }
    }
    setIsLoaded(true);
  }, []);

  // 로그가 업데이트될 때마다 로컬 스토리지에 자동 저장
  useEffect(() => {
    if (isLoaded && logs.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    }
  }, [logs, isLoaded]);

  const addLog = (text: string, type: LogType['type'], animate = true) => {
    setLogs(prev => [...prev, {
      id: crypto.randomUUID(),
      text,
      type,
      isTyping: type === 'system' && animate
    }]);
  };

  const clearLogs = () => {
    setLogs([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { logs, addLog, setLogs, clearLogs, isLoaded };
}