import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { questionText, readingType, cards, readingContent, synthesis, sessionId } = await request.json();

  // 민감 컬럼은 Vault+pgcrypto로 암호화하여 저장한다 (insert_reading RPC).
  // user_id는 RPC 내부에서 auth.uid()로 강제.
  const { error } = await supabase.rpc('insert_reading', {
    p_question_text: questionText,
    p_reading_type: readingType,
    p_cards: cards ?? [],
    p_reading_content: readingContent ?? '',
    p_synthesis: synthesis ?? null,
    p_session_id: sessionId ?? null,
  });

  if (error) {
    console.error('[/api/readings/save]', error);
    return NextResponse.json({ error: 'INSERT_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
