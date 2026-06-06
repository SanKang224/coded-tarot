import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const SYSTEM_PROMPT = `너는 CODED TAROT의 마녀다.
사용자가 이미 완료된 타로 리딩의 결론을 다시 묻고 있다.
이전 리딩 요약을 보고 핵심 결론 1~2문장만 출력하라.

규칙:
- 새 해석 금지. 이미 나온 카드와 리딩을 바탕으로만 말하라.
- 직접적으로: "예" / "아니오" / "불가" / "A가 낫다" 등 판단을 먼저 내려라.
- 2문장 이내로 끝낼 것. 장황하게 설명하지 마라.
- 문체: ~다. ~이다. ~하라. — ~해요/~습니다 절대 금지.
- 위로 표현 금지.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const { sessionSummary, questionContext } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ conclusion: '카드는 이미 말했다. 다시 읽어라.' });
  }

  const userPrompt = `[이번 세션 리딩 기록]
${sessionSummary}

[사용자 질문 맥락]
${questionContext || '없음'}

위 리딩의 결론을 한 번 더 정리하라.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 256 },
        }),
      }
    );
    const data = await response.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    return NextResponse.json({ conclusion: text || '카드는 이미 말했다. 다시 읽어라.' });
  } catch (error) {
    console.error('[/api/conclude]', error);
    return NextResponse.json({ conclusion: '오라클 회선 불안정.' });
  }
}
