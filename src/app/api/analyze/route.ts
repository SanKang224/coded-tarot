import { NextResponse } from 'next/server';
import { buildAnalysisPrompt } from '@/lib/systemPrompt';

export async function POST(request: Request) {
  try {
    const { currentInput, context, isOwner, prevTopicContext, sessionContext, skipConfirm } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    const allInputs: string[] = [...(context || []), currentInput];
    const fullHistory = allInputs.join('\n> ');

    if (!apiKey) {
      return NextResponse.json({
        analysis: 'TYPE: QUESTION\nCARDS: 1\nPOSITION_01 ║ 핵심 > 지금 이 상황에서 당신이 가장 먼저 직면해야 할 것은 무엇인가',
      });
    }

    const prompt = buildAnalysisPrompt(fullHistory, isOwner ?? true, prevTopicContext ?? '', sessionContext ?? '', skipConfirm ?? false);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    const aiText: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      '■ 분석 회선이 끊겼다. 고민을 다시 한 문장으로 정리하라.';

    return NextResponse.json({ analysis: aiText });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { analysis: '■ 회선 장애. 잠시 후 다시 시도하라.' },
      { status: 500 }
    );
  }
}
