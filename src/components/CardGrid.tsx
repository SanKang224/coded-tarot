'use client';
import { useState } from 'react';

interface CardGridProps {
  deck: { id: number; isReversed: boolean }[];
  requiredCount: number;
  disabledIndices?: Set<number>;
  onSelectAll: (deckIndices: number[]) => void;
}

const NOISE = ['░', '▒', '▓', '█', '∴', '∵', '⁘', '⁙'];
function noise() { return NOISE[Math.floor(Math.random() * NOISE.length)]; }

export default function CardGrid({ deck, requiredCount, disabledIndices = new Set(), onSelectAll }: CardGridProps) {
  const [cardStyles] = useState<{ opacity: number; prefix: string }[]>(() =>
    Array.from({ length: 78 }, () => ({
      opacity: parseFloat((0.4 + Math.random() * 0.6).toFixed(2)),
      prefix: Math.random() < 0.35 ? noise() : '',
    }))
  );

  const [selected, setSelected] = useState<number[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleClick = (deckIdx: number) => {
    if (confirmed) return;
    if (disabledIndices.has(deckIdx)) return;
    const alreadyAt = selected.indexOf(deckIdx);
    if (alreadyAt !== -1) {
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
  const COLS = 6;
  const rows: number[][] = [];
  for (let r = 0; r < 13; r++) {
    const row: number[] = [];
    for (let c = 0; c < COLS; c++) {
      const deckIdx = r * COLS + c;
      if (deckIdx < 78) row.push(deckIdx);
    }
    rows.push(row);
  }

  return (
    <div className="my-2" style={{ borderTop: '1px solid rgba(0,255,65,0.2)', paddingTop: '8px' }}>
      <div style={{ color: 'rgba(0,255,65,0.5)', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.04em', fontFamily: 'monospace' }}>
        {confirmed
          ? `>> ${requiredCount}장 선택 완료 — 오라클에 전달 중...`
          : remaining === requiredCount
          ? `>> 카드 ${requiredCount}장을 순서대로 골라라.`
          : `>> ${selected.length}/${requiredCount} 선택됨 — ${remaining}장 더 고르라.`
        }
      </div>
      <table style={{ borderCollapse: 'separate', borderSpacing: '2px 2px', width: '100%', tableLayout: 'fixed', fontFamily: 'var(--font-roboto-mono), "Courier New", monospace' }}>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((deckIdx) => {
                const displayNum = String(deckIdx + 1).padStart(2, '0');
                const selOrder = selected.indexOf(deckIdx);
                const isSelected = selOrder !== -1;
                const isDisabled = disabledIndices.has(deckIdx) || (confirmed && !isSelected);
                const isHovered = hovered === deckIdx && !isDisabled && !confirmed;
                const { opacity, prefix } = cardStyles[deckIdx];
                return (
                  <td
                    key={deckIdx}
                    onClick={() => handleClick(deckIdx)}
                    onMouseEnter={() => setHovered(deckIdx)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      cursor: isDisabled ? 'default' : 'pointer',
                      fontSize: '11px',
                      letterSpacing: '0.01em',
                      userSelect: 'none',
                      textAlign: 'center',
                      padding: '2px 1px',
                      color: isSelected ? '#000000' : isDisabled ? '#444444' : isHovered ? '#000000' : '#00FF41',
                      background: isSelected ? '#00FF41' : isDisabled ? 'rgba(60,60,60,0.3)' : isHovered ? '#00FF41' : 'transparent',
                      opacity: isDisabled && !isSelected ? 0.5 : isSelected ? 1 : isHovered ? 1 : opacity,
                      textDecoration: isDisabled && !isSelected ? 'line-through' : 'none',
                      transition: 'opacity 0.12s, background 0.08s, color 0.08s',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    {isSelected ? `[${selOrder + 1}·C${displayNum}]` : `${prefix}[C${displayNum}]`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {selected.length >= 2 && !confirmed && (
        <div style={{ marginTop: '6px', color: 'rgba(0,255,65,0.6)', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
          {`>> 선택: ${selected.map((idx, i) => `[${i + 1}·C${String(idx + 1).padStart(2, '0')}]`).join(' ')}`}
        </div>
      )}
    </div>
  );
}
