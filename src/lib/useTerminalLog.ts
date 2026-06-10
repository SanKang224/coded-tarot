import { useState, useEffect } from 'react';

export type LogType = {
  id: string;
  text: string;
  type: 'system' | 'user' | 'separator' | 'witch';
  isTyping?: boolean;
  dead?: boolean; // witch 독백 발광 종료 → 회색 죽은 글자 처리
  struck?: boolean; // 제거된 기록 → 취소선
  small?: boolean; // 작은 글씨 (공지 본문·기록 재생)
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

    // OAuth/결제로 의도적으로 떠났다 돌아온 경우(safe_leave)는 navType이 reload로 잡혀도 로그 보존.
    // (이 effect는 Terminal의 safe_leave 제거 effect보다 먼저 실행되어 플래그를 읽을 수 있다)
    const intentionalReturn = sessionStorage.getItem('safe_leave') === 'true';

    if (navType === 'reload' && !intentionalReturn) {
      // 진짜 수동 새로고침: 로그 초기화
      sessionStorage.removeItem(STORAGE_KEY);
      setLogs([]);
    } else {
      // 일반 진입 / OAuth·결제 복귀: sessionStorage에 있으면 복원
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

  // 로그 변경 시 sessionStorage에 저장 (200개 초과 시 오래된 항목 자동 트림)
  useEffect(() => {
    if (isLoaded && logs.length > 0) {
      const toSave = logs.length > 200 ? logs.slice(-200) : logs;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    }
  }, [logs, isLoaded]);

  const addLog = (text: string, type: LogType['type'], animate = true, small = false) => {
    const id = crypto.randomUUID();
    setLogs(prev => [...prev, {
      id,
      text,
      type,
      isTyping: (type === 'system' || type === 'witch') && animate,
      small
    }]);
    return id;
  };
  
  // 특정 로그들에 패치 적용 (재생한 기록을 회색/취소선 처리할 때 사용)
  const markLogs = (ids: string[], patch: Partial<LogType>) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setLogs(prev => prev.map(l => (idSet.has(l.id) ? { ...l, ...patch } : l)));
  };

  const clearLogs = () => {
    setLogs([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  // witch 독백 발광을 일괄 종료 (회색 죽은 글자로 전환)
  const extinguishWitchLogs = () => {
    setLogs(prev => prev.map(l => (l.type === 'witch' ? { ...l, dead: true } : l)));
  };

  return { logs, addLog, setLogs, clearLogs, extinguishWitchLogs, markLogs, isLoaded };
}