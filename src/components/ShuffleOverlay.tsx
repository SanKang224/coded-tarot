'use client';
import { useState, useEffect, useRef } from 'react';
import type { Card } from '@/lib/shuffler';

interface ShuffleOverlayProps {
  topCard: Card | null;
  onComplete: () => void;
  scrollToBottom: () => void;
}

const NOISE_POOL = '░▒▓█∫∮∝∞▰▱◈◉⊕⊗⌬⍟⎔⎕☿♆☽∂∇∆∅∈∩∪≈≠≡⟁⌭⏣';

function noise(len: number) {
  return Array.from({ length: len }, () =>
    NOISE_POOL[Math.floor(Math.random() * NOISE_POOL.length)]
  ).join('');
}

type LineType = 'system' | 'danger' | 'ok' | 'noise';

interface LogLine {
  id: number;
  text: string;
  type: LineType;
  isLive: boolean;
}

const STEPS: { delay: number; text: string; type: LineType; isLive: boolean }[] = [
  { delay: 0,    text: '[SYSTEM] ACCESSING 78_CARD_DATA...',            type: 'system', isLive: false },
  { delay: 380,  text: noise(28),                                        type: 'noise',  isLive: true  },
  { delay: 700,  text: '[INIT] LOADING ARCANA_MATRIX... [OK]',          type: 'ok',     isLive: false },
  { delay: 1200, text: '[DANGER] REVERSING SECTOR_B (39 CARDS)...',     type: 'danger', isLive: false },
  { delay: 1650, text: noise(28),                                        type: 'noise',  isLive: true  },
  { delay: 2000, text: '[PROCESS] RIFFLE_MERGE :: CYCLE_01... [OK]',    type: 'ok',     isLive: false },
  { delay: 2450, text: '[PROCESS] RIFFLE_MERGE :: CYCLE_02... [OK]',    type: 'ok',     isLive: false },
  { delay: 2800, text: noise(28),                                        type: 'noise',  isLive: true  },
  { delay: 3100, text: '[COMPILING] INTERLEAVING DATA_BLOCKS... [OK]',  type: 'ok',     isLive: false },
  { delay: 3550, text: '[STABILIZING] TRIPLE_CUT_REORDERING COMPLETE.', type: 'system', isLive: false },
  { delay: 3950, text: '[OUTPUT] SCANNING DECK SURFACE...',             type: 'system', isLive: false },
];

const TYPE_COLORS: Record<LineType, string> = {
  system: '#00FF41',
  danger: '#FF3300',
  ok:     '#00FF41',
  noise:  '#005A18',
};

const SLOT_START_MS  = 4250;
const SLOT_SETTLE_MS = 5000;
const COMPLETE_MS    = 5500;

export default function ShuffleOverlay({ topCard, onComplete, scrollToBottom }: ShuffleOverlayProps) {
  const [lines, setLines]             = useState<LogLine[]>([]);
  const [showSlot, setShowSlot]       = useState(false);
  const [settling, setSettling]       = useState(false);
  const [slotDisplay, setSlotDisplay] = useState<{ id: number; reversed: boolean }>({ id: 0, reversed: false });
  const lineIdRef   = useRef(0);
  const settlingRef = useRef(false);
  const timers      = useRef<(ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>)[]>([]);

  const clearTimers = () => {
    timers.current.forEach(t => {
      clearTimeout(t as ReturnType<typeof setTimeout>);
      clearInterval(t as ReturnType<typeof setInterval>);
    });
    timers.current = [];
  };

  // 라인 추가 또는 슬롯머신 표시 시 스크롤
  useEffect(() => { scrollToBottom(); }, [lines.length, showSlot, settling]);

  useEffect(() => {
    lineIdRef.current = 0;
    settlingRef.current = false;

    STEPS.forEach(step => {
      timers.current.push(setTimeout(() => {
        const id = lineIdRef.current++;
        setLines(prev => [...prev, { id, text: step.text, type: step.type, isLive: step.isLive }]);
      }, step.delay));
    });

    timers.current.push(setInterval(() => {
      setLines(prev => prev.map(l => l.isLive ? { ...l, text: noise(28) } : l));
    }, 75));

    timers.current.push(setTimeout(() => setShowSlot(true), SLOT_START_MS));

    timers.current.push(setInterval(() => {
      if (!settlingRef.current) {
        setSlotDisplay({ id: Math.floor(Math.random() * 78), reversed: Math.random() > 0.5 });
      }
    }, 55));

    timers.current.push(setTimeout(() => {
      settlingRef.current = true;
      setSettling(true);
      if (topCard) setSlotDisplay({ id: topCard.id, reversed: topCard.isReversed });
    }, SLOT_SETTLE_MS));

    timers.current.push(setTimeout(() => {
      clearTimers();
      onComplete();
    }, COMPLETE_MS));

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-1 text-[16px] leading-[1.8] break-words whitespace-pre-wrap">
      {lines.map(line => (
        <div
          key={line.id}
          style={{ color: TYPE_COLORS[line.type], opacity: line.isLive ? 0.5 : 1 }}
        >
          {line.text}
        </div>
      ))}

      {showSlot && (
        <div
          className="my-1 py-1 text-center"
          style={{
            border: `1px solid ${settling ? '#00FF41' : '#004A12'}`,
            color: '#00FF41',
            boxShadow: settling ? '0 0 8px rgba(0,255,65,0.25)' : 'none',
            transition: 'border-color 0.4s, box-shadow 0.4s',
            fontSize: '16px',
          }}
        >
          <div style={{ opacity: 0.3, fontSize: '12px' }}>╔══ DECK_SURFACE ══╗</div>
          <div style={{ fontWeight: 'bold', letterSpacing: '0.08em' }}>
            CARD #{String(slotDisplay.id + 1).padStart(2, '0')}
          </div>
          <div style={{ color: settling ? '#00FF41' : '#006A20', transition: 'color 0.4s' }}>
            {slotDisplay.reversed ? '[ 역  방  향 ]' : '[ 정  방  향 ]'}
          </div>
          <div style={{ opacity: 0.3, fontSize: '12px' }}>╚══════════════════╝</div>
        </div>
      )}
    </div>
  );
}
