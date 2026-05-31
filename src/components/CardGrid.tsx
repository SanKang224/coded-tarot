'use client';
import { useEffect, useRef, useState } from 'react';

interface CardGridProps {
  deck: { id: number; isReversed: boolean }[];
  requiredCount: number;          // 이번 리딩에서 뽑아야 할 카드 수
  disabledIndices?: Set<number>;  // 이미 뽑힌 덱 인덱스
  onSelectAll: (deckIndices: number[]) => void;
}

const NOISE = ['░', '▒', '▓', '█', '∴', '∵', '⁘', '⁙'];
function noise() { return NOISE[Math.floor(Math.random() * NOISE.length)]; }

/**
 * 78장 카드 코드 그리드 — 다중 선택 모드
 * - requiredCount장을 순서대로 선택하면 onSelectAll 호출
 * - 선택된 카드에 순서 번호 표시 (1, 2, 3...)
 * - disabledIndices에 있는 카드는 뽑기 불가 (이전 리딩에서 사용됨)
 */
export default function CardGrid({ deck, requiredCount, disabledIndices = new Set(), onSelectAll }: CardGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [cardStyles] = useState<{ opacity: number; prefix: string }[]>(() =>
    Array.from({ length: 78 }, () => ({
      opacity: parseFloat((0.4 + Math.random() * 0.6).toFixed(2)),
      prefix: Math.random() < 0.35 ? noise() : '',
    }))
  );

  const [selected, setSelected] = useState<number[]>([]); // 선택 순서대로 deck index 저장
  const [hovered, setHovered] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, []);

  const handleClick = (deckIdx: number) => {
    if (confirmed) return;
    if (disabledIndices.has(deckIdx)) return;

    const alreadyAt = selected.indexOf(deckIdx);

    if (alreadyAt !== -1) {
      // 이미 선택된 카드 → 선택 해제
      setSelected(prev => prev.filter((_, i) => i !== alreadyAt));
      return;
    }

    if (selected.length >= requiredCount) return;

    const next = [...selected, deckIdx];
    setSelected(next);

    if (next.length === requiredCount) {
      setConfirmed(true);
      onSelectAll(next);
    }
  };

  const remaining = requiredCount - selected.length;

  return (
    <div
      className="my-2"
      style={{ borderTop: '1px solid rgba(0,255,65,0.2)', paddingTop: '8px' }}
    >
      {/* 안내 텍스트 */}
      <div style={{ color: 'rgba(0,255,65,0.5)', fontSize: '12px', marginBottom: '6px', letterSpacing: '0.04em' }}>
        {confirmed
          ? `>> ${requiredCount}장 선택 완료 — 오라클에 전달 중...`
          : remaining === requiredCount
          ? `>> 카드 ${requiredCount}장을 순서대로 골라라.`
          : `>> ${selected.length}/${requiredCount} 선택됨 — ${remaining}장 더 고르라.`
        }
      </div>

      {/* 1행 가로 스크롤 */}
      <div
        ref={scrollRef}
        className="card-grid-scroll"
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          whiteSpace: 'nowrap',
          paddingBottom: '10px',
        }}
      >
        {deck.map((_, deckIdx) => {
          const displayNum = String(deckIdx + 1).padStart(2, '0');
          const selOrder = selected.indexOf(deckIdx); // -1이면 미선택
          const isSelected = selOrder !== -1;
          const isDisabled = disabledIndices.has(deckIdx) || (confirmed && !isSelected);
          const isHovered = hovered === deckIdx && !isDisabled && !confirmed;
          const { opacity, prefix } = cardStyles[deckIdx];

          return (
            <span
              key={deckIdx}
              onClick={() => handleClick(deckIdx)}
              onMouseEnter={() => setHovered(deckIdx)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'inline-block',
                marginRight: '6px',
                cursor: isDisabled ? 'default' : 'pointer',
                fontFamily: 'monospace',
                fontSize: '13px',
                letterSpacing: '0.02em',
                userSelect: 'none',
                position: 'relative',
                color: isSelected
                  ? '#000000'
                  : isDisabled
                  ? '#555555'
                  : isHovered
                  ? '#000000'
                  : '#00FF41',
                background: isSelected
                  ? '#00FF41'
                  : isDisabled
                  ? 'rgba(80,80,80,0.25)'
                  : isHovered
                  ? '#00FF41'
                  : 'transparent',
                opacity: isDisabled && !isSelected ? 1 : isSelected ? 1 : isHovered ? 1 : opacity,
                textDecoration: isDisabled ? 'line-through' : 'none',
                padding: '1px 4px',
                transition: 'opacity 0.15s, background 0.1s, color 0.1s',
              }}
            >
              {isSelected
                ? `[${selOrder + 1}·C${displayNum}]`
                : `${prefix}[C${displayNum}]`
              }
            </span>
          );
        })}
      </div>
    </div>
  );
}
