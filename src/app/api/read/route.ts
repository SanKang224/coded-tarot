import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const READING_SYSTEM_PROMPT = `너는 CODED TAROT의 마녀다.
타로 카드를 해석하되, 반드시 아래 형식을 엄격하게 따르라.

출력 형식 (정확히 이 구조):
선고: "한 줄 선고문"
해석: 3~5문장 해석

규칙:
- 선고는 반드시 큰따옴표로 감쌀 것. 짧고 날카롭게.
- 해석은 카드의 에너지를 질문과 연결해 풀어낼 것. 반드시 완성된 문장으로 끝낼 것. 3~4문장 이내로 간결하게.
- 역방향은 에너지가 막히거나 내면화된 관점으로 해석하라.
- 문체: ~다. ~인가. ~이다. — ~해요/~합니다/~하세요 절대 금지.
- 화려한 수식어 남발 금지. 직접적으로 말하라.
- 영적 클리셰("우주가", "에너지를 받아들여라" 등) 금지.
- 반드시 한국어로만 출력하라. 영어 단어 한 글자도 포함하지 마라.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { card, position, questionContext } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  const directionStr = card.isReversed ? '역방향' : '정방향';
  const keywords = card.isReversed
    ? (card.reversedKeywords ?? []).join(', ')
    : (card.uprightKeywords ?? []).join(', ');

  const userPrompt = `[카드] ${card.nameKo} (${card.name}) — ${directionStr}
[키워드] ${keywords}
[포지션] ${position.name}: ${position.question}
[질문 컨텍스트] ${questionContext || '없음'}

위 카드를 해석하라.`;

  if (!apiKey) {
    return NextResponse.json({
      reading: `"카드는 답을 알고 있다."\n${card.nameKo}의 에너지가 이 자리에 놓였다. ${directionStr}으로 나타난 이 카드는 지금 네가 직면한 것을 가리킨다.`,
    });
  }

  try {
    const fullPrompt = `${READING_SYSTEM_PROMPT}\n\n${userPrompt}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    const data = await response.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!raw) {
      return NextResponse.json({
        reading: '"카드는 침묵한다."\n오라클 회선이 불안정하다. 잠시 후 다시 시도하라.',
      });
    }

    const verdictMatch = raw.match(/선고\s*[:：]\s*"([^"]+)"/);
    const interpretMatch = raw.match(/해석\s*[:：]\s*([\s\S]+)/);

    const verdict = verdictMatch ? `"${verdictMatch[1]}"` : null;
    const interpret = interpretMatch ? interpretMatch[1].trim() : raw;

    const reading = verdict ? `${verdict}\n${interpret}` : interpret;

    return NextResponse.json({ reading });
  } catch (error) {
    console.error('[/api/read]', error);
    return NextResponse.json({
      reading: '"카드는 침묵한다."\n오라클 회선이 불안정하다. 잠시 후 다시 시도하라.',
    });
  }
}
