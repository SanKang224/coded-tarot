import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { buildAdviceNudgePrompt } from '@/lib/systemPrompt';

// 조언 유도 — 리딩 완료 직후 호출.
// 결과가 질문자의 바람에 어긋나는지(againstDesire) 판정하고, 어긋날 때만 마녀 혼잣말(nudge) 반환.
// 실패/키 부재 시 againstDesire:false → 클라이언트는 [조언]을 띄우지 않는다.
type ReadingInput = {
  positionName?: string;
  positionQuestion?: string;
  cardNameKo?: string;
  isReversed?: boolean;
  reading?: string;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ againstDesire: false, nudge: '' }, { status: 401 });
  }

  try {
    const { questionContext, readings, synthesis } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || !Array.isArray(readings) || readings.length === 0) {
      return NextResponse.json({ againstDesire: false, nudge: '' });
    }

    const readingsSummary = (readings as ReadingInput[])
      .map(r => `[${r.positionName ?? '포지션'}] ${r.positionQuestion ?? ''}\n${r.cardNameKo ?? ''}${r.isReversed ? '(역방향)' : '(정방향)'}: ${(r.reading ?? '').slice(0, 300)}`)
      .join('\n\n');
    const readingSummary = synthesis
      ? `${readingsSummary}\n\n[종합]\n${synthesis}`
      : readingsSummary;

    const prompt = buildAdviceNudgePrompt(String(questionContext ?? '없음'), readingSummary);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8 },
        }),
      }
    );

    const data = await response.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    // 각 레이블은 한 줄. 라인 단위로 추출한다.
    const pick = (label: string) =>
      raw.match(new RegExp(label + '\\s*[:：]\\s*([^\\n]*)', 'i'))?.[1]?.trim() ?? '';
    const clean = (s: string) => s.replace(/^["'\[\s]+|["'\]\s]+$/g, '').trim();

    const againstDesire = /^YES/i.test(pick('AGAINST_DESIRE'));
    const nudge = againstDesire ? pick('NUDGE') : '';

    const curiosity = /^YES/i.test(pick('CURIOSITY'));
    const murmur = curiosity ? pick('MURMUR') : '';
    const followUps = curiosity
      ? [clean(pick('FOLLOWUP_1')), clean(pick('FOLLOWUP_2'))].filter(Boolean).slice(0, 2)
      : [];

    return NextResponse.json({ againstDesire, nudge, curiosity, murmur, followUps });
  } catch (error) {
    console.error('[/api/advice-nudge]', error);
    return NextResponse.json({ againstDesire: false, nudge: '' });
  }
}
