import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // 토큰 잔액
  const { data: profile } = await supabase
    .from('profiles')
    .select('token_balance, is_admin')
    .eq('id', user.id)
    .single();

  // 리딩 기록 (최근 10건)
  const { data: readings } = await supabase
    .from('readings')
    .select('id, created_at, question_text, reading_type, cards, synthesis')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  // 결제 내역 (3년 이내, 최신순)
  const { data: payments } = await supabase
    .from('payments')
    .select('id, created_at, amount, tokens_added, package_name')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  return NextResponse.json({
    tokenBalance: profile?.token_balance ?? 0,
    isAdmin: profile?.is_admin ?? false,
    readings: readings ?? [],
    payments: payments ?? [],
  });
}
