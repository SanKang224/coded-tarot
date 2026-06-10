import { NextResponse } from 'next/server';
import { buildAcknowledgmentPrompt } from '@/lib/systemPrompt';

// 마녀의 인지 — 플랜 확정 직후 호출. 확정 질문이 담지 못한 고민의 결을 혼잣말로 되짚는다.
// 실패/키 부재 시 빈 문자열 반환 → 클라이언트는 조용히 건너뛴다(리딩 흐름 비차단).
export async function POST(req: Request) {
  try {
    const { history, positions } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || !history) {
      return NextResponse.json({ acknowledgment: '' });
    }

    const prompt = buildAcknowledgmentPrompt(
      String(history),
      Array.isArray(positions) ? positions.map(String) : []
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.85,
            // maxOutputTokens 제거 — thinking 토큰 포함 한도로 인한 중간 잘림 방지 (synthesis와 동일)
          },
        }),
      }
    );

    const data = await response.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    return NextResponse.json({ acknowledgment: raw });
  } catch (error) {
    console.error('[/api/acknowledge]', error);
    return NextResponse.json({ acknowledgment: '' });
  }
}
