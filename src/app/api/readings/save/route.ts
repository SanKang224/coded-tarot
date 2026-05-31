import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { questionText, readingType, cards, readingContent, synthesis } = await request.json();

  const { error } = await supabase
    .from('readings')
    .insert({
      user_id: user.id,
      question_text: questionText,
      reading_type: readingType,
      cards: cards ?? [],
      reading_content: readingContent ?? '',
      synthesis: synthesis ?? null,
    });

  if (error) {
    console.error('[/api/readings/save]', error);
    return NextResponse.json({ error: 'INSERT_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
