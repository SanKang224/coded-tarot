'use client';
import { useEffect, useState } from 'react';

export type CardReadingResult = {
  positionName: string;
  positionQuestion: string;
  cardNum: number;      // 1-based display number
  cardNameKo: string;
  isReversed: boolean;
  reading: string;      // "선고\n해석" 2줄
};

interface CardReadingProps {
  result: CardReadingResult;
  onComplete?: () => void;
}

/**
 * 단일 카드 리딩 결과 렌더링
 * 포지션 헤더 + 카드명 + 선고(쌍따옴표) + 해석 1줄
 * 줄단위 타이핑 애니메이션
 */
export default function CardReading({ result, onComplete }: CardReadingProps) {
  const directionLabel = result.isReversed ? '[역방향]' : '[정방향]';
  const cardLine = `CARD #${String(result.cardNum).padStart(2, '0')} — ${result.cardNameKo} ${directionLabel}`;

  const lines = [
    `✦ ${result.positionName}`,
    `   "${result.positionQuestion}"`,
    ``,
    cardLine,
    ``,
    ...result.reading.split('\n').filter(Boolean),
  ];

  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
  }, [result.cardNum]);

  useEffect(() => {
    if (visibleCount >= lines.length) {
      onComplete?.();
      return;
    }
    const line = lines[visibleCount];
    const delay = line.trim() === '' ? 60
      : line.startsWith('✦') ? 220
      : line.startsWith('CARD') ? 100
      : line.startsWith('"') ? 160
      : 90;
    const timer = setTimeout(() => setVisibleCount(v => v + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleCount, lines, onComplete]);

  return (
    <div
      className="my-2 p-3"
      style={{
        background: 'rgba(0, 20, 5, 0.6)',
        border: '1px solid rgba(0, 255, 65, 0.25)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 0 20px rgba(0, 255, 65, 0.08)',
      }}
    >
      {lines.slice(0, visibleCount).map((line, i) => {
        const isHeader = line.startsWith('✦');
        const isVerdict = line.startsWith('"') && !line.startsWith('   "');
        const isCardLine = line.startsWith('CARD');
        const isSubQuestion = line.startsWith('   "');

        return (
          <div
            key={i}
            style={{
              color: isHeader
                ? '#00FF41'
                : isVerdict
                ? 'rgba(0,255,65,0.95)'
                : isCardLine
                ? 'rgba(0,255,65,0.6)'
                : isSubQuestion
                ? 'rgba(0,255,65,0.45)'
                : 'rgba(0,255,65,0.8)',
              fontWeight: isHeader || isVerdict ? 'bold' : 'normal',
              fontStyle: isSubQuestion ? 'italic' : 'normal',
              letterSpacing: isHeader ? '0.06em' : '0.02em',
              fontSize: isVerdict ? '14px' : isCardLine ? '11px' : '13px',
              lineHeight: '1.75',
              marginTop: isHeader && i > 0 ? '10px' : undefined,
            }}
          >
            {line || ' '}
          </div>
        );
      })}
      {visibleCount < lines.length && (
        <span
          className="cursor-blink inline-block w-2 h-4 ml-0.5"
          style={{ background: '#00FF41', verticalAlign: 'text-bottom' }}
        />
      )}
    </div>
  );
}
