import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('readings')
    .select('id, created_at, question_text, reading_type, cards, reading_content, synthesis')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[/api/readings/list]', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ readings: data ?? [] });
}
