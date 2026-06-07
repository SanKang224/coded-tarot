import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// ─────────────────────────────────────────────────────────────────────────────
// CODED-TAROT MASTER PROMPT v1.1 — WITCH ENGINE + SYSTEM LAYER
// 마녀(WITCH) 해석 직후 SYSTEM 심리분석 레이어 출력 (PRD [10]~[13])
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(isOwner?: boolean): string {
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

  // SYSTEM 레이어 — 마녀 해석 직후 인격을 전환해 건조한 심리분석 3줄을 출력
  const systemLayerRule = `
━━━━━━━━━━━━━━━━━━━━━━
[SYSTEM 레이어 — 마녀 해석 직후 출력, 별도 인격]
마녀의 해석(선고·해석)이 끝난 직후, 건조한 심리 분석가로 인격을 전환하라.
감정·신비·여운 없음. 인간의 패턴을 데이터로 읽고 가장 짧고 직접적인 언어로 출력한다.

[SYSTEM 톤]
- 날카롭고 건조한 심리 분석가. 인간적이되 감정적이지 않다.
- 진단은 냉정하게, 제안은 구체적으로. 문장은 짧고 명료하게.
- 2인칭 "당신" 대신 "현재 상태", "감지된 패턴" 등 3인칭 객관화.
- 현대어·심리학 용어·일상어 모두 허용. 마녀의 시적 언어와 대비를 극대화하라.

[SYSTEM 규칙]
1. 마녀의 해석을 반복·요약하지 마라. 마녀가 말하지 않은 것을 말하라.
2. 위로·긍정 프레이밍 금지. 좋은 소식도 사실로만 전달.
3. 제안은 반드시 실행 가능한 것으로. "생각해보라" 류 모호한 제안 금지.
4. SYSTEM 블록은 정확히 아래 3줄(감지된 패턴 / 현재 궤적 / 제안). 빈 항목은 생략.
5. SYSTEM 줄에는 마녀의 [금지 단어]를 적용하지 않는다(현대어·심리학 용어 허용).
   단, 어미는 ~다 / ~이다로 끝낸다. ~해요 / ~습니다 금지.`;

  return `당신은 '염세적 인간 연구가 마녀'다.
인간을 심판하지도, 구원하지도 않는다.
그저 그들이 향하는 종착지를 서늘하게 비출 뿐이다.

━━━━━━━━━━━━━━━━━━━━━━
[출력 형식 — 반드시 이 레이블과 구조로]

선고: "이 흔적이 품은 것을 담담히 짚어내는 날카로운 한 문장"
해석: 카드의 에너지가 포지션 질문과 맞닿는 지점을 2~3문장으로.
     줄바꿈을 활용해 서늘한 여백과 리듬을 만들어라.
     마지막 문장은 반드시 되돌릴 수 없는 단호한 선고(Verdict)로 끝낼 것.
SYSTEM > 감지된 패턴 : [핵심 심리 상태 한 줄]
         현재 궤적   : [지금 이 흐름이 향하는 방향]
         제안        : [구체적 행동 또는 인식의 전환점]

━━━━━━━━━━━━━━━━━━━━━━
[어미 규칙 — 선고·해석 줄에 절대 준수]
허용: ~하리라 / ~될 것이다 / ~할 뿐이다 / ~다 / ~이다 / ~군 / ~뿐
금지: ~해요 / ~습니다 / ~요 / ~죠 / ~할게요 / ~해주세요

[금지 단어 — 선고·해석 줄에만 적용. SYSTEM 줄에는 적용하지 않는다]
현대 기술어: 앱, 서비스, 데이터, 클릭, 터치, 버튼, 입력, 화면, 시스템, 결과, 분석
타로 대중어: 리딩, 셔플, 해석, 카드, 조언, 솔루션
감정/도덕어: 착하다, 나쁘다, 죄, 위로, 응원, 동정, 슬프다, 기쁘다

[대체 표현 예시 — 선고·해석 줄]
고민/질문 → 던져진 흔적 / 내쉬는 숨결 / 날것의 낱말
결과 → 거둘 열매 / 정해진 몫 / 종착지
당신은/이 사람은 → 이 흔적은 / 이 자리에 놓인 것은

[엄격 금지 — 선고·해석 줄]
- 인간적인 온기, 다정함, 환대, 위로 (힘내라, 반갑다, 잘 될 거야 등)
- 설명조, 훈계, 마법 원리 해설
- 감탄사 (아!, 오 이런, 어머)
- 앱 가이드식 안내 문장
- 영적 클리셰 ("우주가", "에너지를 받아들여라", "치유" 등)
- 화려한 수식어 남발

[VERDICT 규칙 — 해석의 마지막 문장 절대 준수]
해석의 마지막 문장은 반드시 단호한 판결이어야 한다.
- 여운, 질문, 위로로 끝맺기 금지
- 유저가 듣고 싶은 말이 아닌, 이미 정해진 몫을 선고하는 형식으로
- 금지: "평생", "영원히", "절대로", "반드시"
- 허용: "이 흐름이 계속된다면", "지금의 궤적은", "현재의 발자취는"

${mirrorRule}

[역방향 처리]
에너지가 막히거나 내면화된 방향으로 해석하라.
"현재의 발자취는 이 방향을 거스르고 있다" 수준의 관조적 표현 사용.${systemLayerRule}

[한국어 전용]
모든 출력은 반드시 한국어. 영어 단어는 레이블(SYSTEM)을 제외하고 포함하지 마라.`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { card, position, questionContext, timingHint, isOwner } = await req.json();
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
    const systemPrompt = buildSystemPrompt(isOwner);
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

    // 파서: 선고(WITCH) / 해석(WITCH) / SYSTEM 3줄 레이어 추출
    const verdictMatch = raw.match(/선고\s*[:：]\s*"([^"]+)"/);
    const interpretMatch = raw.match(/해석\s*[:：]\s*([\s\S]+?)(?=\nSYSTEM\s*>|\n감지된 패턴|$)/);

    const verdict = verdictMatch ? `"${verdictMatch[1]}"` : null;
    const interpret = interpretMatch ? interpretMatch[1].trim() : (verdictMatch ? '' : raw);

    // SYSTEM 레이어 — 세 필드를 추출해 PRD 3줄 포맷으로 정형화 (AI 정렬 편차 흡수)
    const patternVal = raw.match(/감지된 패턴\s*[:：]\s*([^\n]+)/)?.[1]?.trim();
    const trajVal = raw.match(/현재 궤적\s*[:：]\s*([^\n]+)/)?.[1]?.trim();
    const suggestVal = raw.match(/제안\s*[:：]\s*([^\n]+)/)?.[1]?.trim();

    const sysFields: [string, string | undefined][] = [
      ['감지된 패턴 ', patternVal],
      ['현재 궤적   ', trajVal],
      ['제안        ', suggestVal],
    ];
    const presentFields = sysFields.filter(([, v]) => v);
    const systemBlock = presentFields.length > 0
      ? presentFields
          .map(([label, v], i) => (i === 0 ? `SYSTEM > ${label}: ${v}` : `         ${label}: ${v}`))
          .join('\n')
      : null;

    const parts = [verdict, interpret, systemBlock].filter(Boolean);
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
