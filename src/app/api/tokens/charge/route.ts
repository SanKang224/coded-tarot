import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const PACKAGES: Record<number, number> = {
  1: 3,
  2: 15,
  3: 30,
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { packageId } = await req.json();
  const tokensToAdd = PACKAGES[packageId];

  if (!tokensToAdd) {
    return NextResponse.json({ error: 'INVALID_PACKAGE' }, { status: 400 });
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

  // 관리자는 잔액 변경 불필요
  if (profile.is_admin) {
    return NextResponse.json({ balance: profile.token_balance, isAdmin: true });
  }

  const newBalance = (profile.token_balance ?? 0) + tokensToAdd;

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ token_balance: newBalance })
    .eq('id', user.id)
    .select('token_balance')
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ balance: updated.token_balance });
}
