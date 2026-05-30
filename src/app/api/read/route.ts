import { NextResponse } from 'next/server';
import { buildReadingPrompt, type CardForReading, type PositionForReading } from '@/lib/systemPrompt';

export async function POST(request: Request) {
  try {
    const { card, position, questionContext } = await request.json() as {
      card: CardForReading;
      position: PositionForReading;
      questionContext: string;
    };

    if (!card) {
      return NextResponse.json({ error: '카드 데이터가 필요하다.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const prompt = buildReadingPrompt(card, position, questionContext || '');

    if (!apiKey) {
      const fallback = buildFallbackReading(card, position);
      return NextResponse.json({ reading: fallback });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 256,
          },
        }),
      }
    );

    const data = await response.json();
    const reading: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      buildFallbackReading(card, position);

    return NextResponse.json({ reading });
  } catch (error) {
    console.error('[/api/read]', error);
    return NextResponse.json(
      { error: '■ 오라클 회선이 불안정하다. 잠시 후 다시 시도하라.' },
      { status: 500 }
    );
  }
}

function buildFallbackReading(card: CardForReading, position: PositionForReading): string {
  const direction = card.isReversed ? '역방향' : '정방향';
  const keyword = (card.isReversed ? card.reversedKeywords : card.uprightKeywords)[0] ?? '침묵';
  return `"${card.nameKo}의 ${direction} 에너지가 이 자리를 점령했다."\n${keyword}의 기운이 ${position.name}에 드리워진다. 카드는 이미 답했다.`;
}
