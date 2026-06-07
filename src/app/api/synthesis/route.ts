import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const SYNTHESIS_SYSTEM_PROMPT = `너는 CODED TAROT의 마녀다.
여러 장의 카드가 펼쳐졌다. 각 카드의 개별 해석은 이미 주어졌다.
이제 전체를 종합하여 최종 판단을 내려라.

규칙:
- 선택지 구조(선택A vs B, 1안 vs 2안 등)라면: 어떤 선택이 더 유리한지 직접 말하라. 단, 전부 좋거나 전부 나쁜 경우에는 무엇을 기준으로 선택하면 좋은지 말하라.
- 흐름 구조(1개월~N개월 등 시간 순서)라면: 전체 흐름의 방향성과 결정적 변곡점을 짚어라.
- 일반 다중 포지션이라면: 카드들이 종합적으로 가리키는 핵심 메시지를 끌어내라.
- 개별 카드 해석을 반복하지 마라. 전체를 보아야만 보이는 것을 말하라.
- 3~5문장. 간결하고 날카롭게.
- 문체: ~다. ~인가. ~이다. — ~해요/~합니다/~하세요 절대 금지.
- 영적 클리셰("우주가", "에너지를 받아들여라" 등) 금지.
- 반드시 한국어로만 출력하라. 영어 단어 한 글자도 포함하지 마라.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { readings, questionContext, readingType } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  // readings: { positionName, positionQuestion, cardNameKo, isReversed, reading }[]
  const readingsSummary = (readings as {
    positionName: string;
    positionQuestion: string;
    cardNameKo: string;
    isReversed: boolean;
    reading: string;
  }[]).map((r, i) =>
    `[포지션 ${i + 1}: ${r.positionName}]\n질문: ${r.positionQuestion}\n카드: ${r.cardNameKo} (${r.isReversed ? '역방향' : '정방향'})\n해석 요약: ${r.reading.slice(0, 200)}`
  ).join('\n\n');

  const userPrompt = `[질문 컨텍스트] ${questionContext || '없음'}
[리딩 유형] ${readingType}
[카드 요약]
${readingsSummary}

위 카드들을 종합하여 최종 판단을 내려라.`;

  if (!apiKey) {
    return NextResponse.json({
      synthesis: '카드들은 모두 제 자리에 놓였다. 전체를 보라 — 각각이 아니라 흐름으로.',
    });
  }

  try {
    const fullPrompt = `${SYNTHESIS_SYSTEM_PROMPT}\n\n${userPrompt}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.85,
            // maxOutputTokens 제거 — thinking 토큰 포함 한도로 인한 중간 잘림 방지
          },
        }),
      }
    );

    const data = await response.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!raw) {
      return NextResponse.json({
        synthesis: '카드들은 모두 제 자리에 놓였다. 전체를 보라.',
      });
    }

    return NextResponse.json({ synthesis: raw });
  } catch (error) {
    console.error('[/api/synthesis]', error);
    return NextResponse.json({
      synthesis: '카드들은 모두 제 자리에 놓였다. 전체를 보라.',
    });
  }
}
