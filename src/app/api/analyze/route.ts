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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 
      "■ 분석 에러: 정신의 파형이 고르지 않습니다. 다시 한 번 구체적인 상황을 서술해 주십시오.";

    return NextResponse.json({ analysis: aiText });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { analysis: "■ 오류: 외부 서버 분석 프로토콜 회선이 불안정합니다. 당신의 마음을 한 문장으로 다시 요약해 주십시오." },
      { status: 500 }
    );
  }
}