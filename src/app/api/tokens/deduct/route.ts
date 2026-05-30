import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // 현재 잔액 조회
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('token_balance, is_admin')
    .eq('id', user.id)
    .single();

  if (fetchError || !profile) {
    return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
  }

  // 관리자는 토큰 차감 없이 통과
  if (profile.is_admin) {
    return NextResponse.json({ balance: profile.token_balance, isAdmin: true });
  }

  if (profile.token_balance <= 0) {
    return NextResponse.json({ error: 'INSUFFICIENT_TOKENS', balance: 0 }, { status: 402 });
  }

  // 1 차감
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ token_balance: profile.token_balance - 1 })
    .eq('id', user.id)
    .select('token_balance')
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ balance: updated.token_balance, isAdmin: false });
}
