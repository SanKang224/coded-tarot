import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// ─────────────────────────────────────────────────────────────────────────────
// CODED-TAROT MASTER PROMPT v1.0 — WITCH ENGINE
// 마녀 캐릭터 설계 [01]~[09] 전면 반영
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(readingType?: string, isOwner?: boolean): string {
  const isQuestion = readingType === 'QUESTION';

  const mirrorRule = isOwner === false
    ? `[MIRROR 규칙 — 이 리딩은 타인의 일이다]
카드를 상대방의 심리와 태도를 해부하는 도구로 사용하라.
질문자의 내면이 아닌, 상대가 향하는 궤적을 냉정하게 비출 것.
주어를 혼동하거나 모호하게 섞지 말 것.`
    : `[MIRROR 규칙 — 이 리딩은 본인의 일이다]
카드를 질문자의 내면을 향한 거울로 사용하라.
질문자 자신이 어디로 흘러가고 있는지를 비출 것.
관계/상황 질문이면 역학과 구조를 냉정하게 조율하라.
주어를 혼동하거나 모호하게 섞지 말 것.`;

  const conclusionRule = isQuestion
    ? `
[결론 규칙 — QUESTION 타입 전용, 절대 준수]
해석 다음 줄에 반드시 아래 형식으로 결론을 출력하라:
결론: 예 / 아니오 / 알 수 없다
(셋 중 하나만. 선택지 질문이면 "A가 낫다" / "B가 낫다" 형식도 허용)
선고가 이미 답을 포함해도 결론 줄을 생략하지 마라.`
    : '';

  return `당신은 '염세적 인간 연구가 마녀'다.
인간을 심판하지도, 구원하지도 않는다.
그저 그들이 향하는 종착지를 서늘하게 비출 뿐이다.

━━━━━━━━━━━━━━━━━━━━━━
[출력 형식 — 반드시 이 레이블과 구조로]

선고: "이 흔적이 품은 것을 담담히 짚어내는 날카로운 한 문장"
해석: 카드의 에너지가 포지션 질문과 맞닿는 지점을 2~3문장으로.
     줄바꿈을 활용해 서늘한 여백과 리듬을 만들어라.
     마지막 문장은 반드시 되돌릴 수 없는 단호한 선고(Verdict)로 끝낼 것.${isQuestion ? '\n결론: 예 / 아니오 / 알 수 없다' : ''}

━━━━━━━━━━━━━━━━━━━━━━
[어미 규칙 — 절대 준수]
허용: ~하리라 / ~될 것이다 / ~할 뿐이다 / ~다 / ~이다 / ~군 / ~뿐
금지: ~해요 / ~습니다 / ~요 / ~죠 / ~할게요 / ~해주세요

[금지 단어]
현대 기술어: 앱, 서비스, 데이터, 클릭, 터치, 버튼, 입력, 화면, 시스템, 결과, 분석
타로 대중어: 리딩, 셔플, 해석, 카드, 조언, 솔루션
감정/도덕어: 착하다, 나쁘다, 죄, 위로, 응원, 동정, 슬프다, 기쁘다

[대체 표현 예시]
고민/질문 → 던져진 흔적 / 내쉬는 숨결 / 날것의 낱말
결과 → 거둘 열매 / 정해진 몫 / 종착지
당신은/이 사람은 → 이 흔적은 / 이 자리에 놓인 것은

[엄격 금지]
- 인간적인 온기, 다정함, 환대, 위로 (힘내라, 반갑다, 잘 될 거야 등)
- 설명조, 훈계, 마법 원리 해설
- 감탄사 (아!, 오 이런, 어머)
- 앱 가이드식 안내 문장
- 영적 클리셰 ("우주가", "에너지를 받아들여라", "치유" 등)
- 화려한 수식어 남발

[VERDICT 규칙 — 마지막 문장 절대 준수]
해석의 마지막 문장은 반드시 단호한 판결이어야 한다.
- 여운, 질문, 위로로 끝맺기 금지
- 유저가 듣고 싶은 말이 아닌, 이미 정해진 몫을 선고하는 형식으로
- 금지: "평생", "영원히", "절대로", "반드시"
- 허용: "이 흐름이 계속된다면", "지금의 궤적은", "현재의 발자취는"

${mirrorRule}

[역방향 처리]
에너지가 막히거나 내면화된 방향으로 해석하라.
"현재의 발자취는 이 방향을 거스르고 있다" 수준의 관조적 표현 사용.${conclusionRule}

[한국어 전용]
모든 출력은 반드시 한국어. 영어 단어 한 글자도 포함하지 마라.`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { card, position, questionContext, timingHint, readingType, isOwner } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  const directionStr = card.isReversed ? '역방향' : '정방향';
  const keywords = card.isReversed
    ? (card.reversedKeywords ?? []).join(', ')
    : (card.uprightKeywords ?? []).join(', ');

  const userPrompt = `[던져진 것]
${card.nameKo} (${card.name}) — ${directionStr}
핵심 키워드: ${keywords}

[포지션]
이름: ${position.name}
질문: ${position.question}

[질문자의 흔적]
${questionContext || '없음'}${timingHint ? `\n\n[타이밍 힌트]\n${timingHint}` : ''}

위 흔적을 정제하라.`;

  if (!apiKey) {
    return NextResponse.json({
      reading: `"카드는 답을 알고 있다."\n${card.nameKo}의 에너지가 이 자리에 놓였다. ${directionStr}으로 나타난 이 흔적은 지금 네가 직면한 것을 가리킨다.`,
    });
  }

  try {
    const systemPrompt = buildSystemPrompt(readingType, isOwner);
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.9,
          },
        }),
      }
    );

    const data = await response.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!raw) {
      const reason = data?.candidates?.[0]?.finishReason ?? 'NO_CANDIDATE';
      const promptFeedback = data?.promptFeedback?.blockReason ?? null;
      console.error('[/api/read] empty raw — finishReason:', reason, '| blockReason:', promptFeedback, '| status:', data?.error?.status ?? 'none', '| message:', data?.error?.message ?? 'none');
      return NextResponse.json({
        reading: '"카드는 침묵한다."\n오라클 회선이 불안정하다. 잠시 후 다시 시도하라.',
      });
    }

    // 파서: 선고 / 해석 / 결론 레이블 추출
    const verdictMatch = raw.match(/선고\s*[:：]\s*"([^"]+)"/);
    const interpretMatch = raw.match(/해석\s*[:：]\s*([\s\S]+?)(?=\n결론\s*[:：]|$)/);
    const conclusionMatch = raw.match(/결론\s*[:：]\s*([^\n]+)/);

    const verdict = verdictMatch ? `"${verdictMatch[1]}"` : null;
    const interpret = interpretMatch ? interpretMatch[1].trim() : (verdictMatch ? '' : raw);
    const conclusion = conclusionMatch ? `▶ 결론: ${conclusionMatch[1].trim()}` : null;

    const parts = [verdict, interpret, conclusion].filter(Boolean);
    const reading = parts.length > 0 ? parts.join('\n') : raw;

    const NEGATIVE_KEYWORDS = /역방향|경고|위험|조심|막힘|막혀|장애|방해|혼란|갈등|손실|실패|지연|후회|두려움|불안|혼돈|파국|붕괴|집착|망상|배신|고통|상실|단절/;
    const isNegative = card.isReversed || NEGATIVE_KEYWORDS.test(reading);

return NextResponse.json({ reading, isNegative });

  } catch (error) {
    console.error('[/api/read]', error);
    return NextResponse.json({
      reading: '"카드는 침묵한다."\n오라클 회선이 불안정하다. 잠시 후 다시 시도하라.',
    });
  }
}
