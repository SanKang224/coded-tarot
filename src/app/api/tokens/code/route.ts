import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  console.log('[/api/tokens/code] user:', user?.id ?? 'null', 'authError:', authError?.message ?? 'none');

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
  }

  // 환경변수에서 코드 목록 파싱
  const rawPromo = process.env.PROMO_CODES ?? '{}';
  console.log('[/api/tokens/code] PROMO_CODES raw:', rawPromo);
  let promoCodes: Record<string, number> = {};
  try {
    promoCodes = JSON.parse(rawPromo);
    console.log('[/api/tokens/code] parsed:', promoCodes, 'input code:', code.toUpperCase());
  } catch {
    console.error('[/api/tokens/code] JSON parse failed:', rawPromo);
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }

  const tokensToAdd = promoCodes[code.toUpperCase()];
  if (!tokensToAdd) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
  }

  // 총 사용 횟수 확인 (코드별 100명 제한)
  const { count } = await supabase
    .from('code_redemptions')
    .select('*', { count: 'exact', head: true })
    .eq('code', code.toUpperCase());

  if ((count ?? 0) >= 100) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
  }

  // 중복 사용 여부 확인 (unique 제약으로 insert 실패 = 이미 사용)
  const { error: insertError } = await supabase
    .from('code_redemptions')
    .insert({ user_id: user.id, code: code.toUpperCase() });

  if (insertError) {
    // unique 제약 위반 = 이미 사용한 코드
    return NextResponse.json({ error: 'ALREADY_USED' }, { status: 409 });
  }

  // 현재 잔액 조회 후 지급
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('token_balance, is_admin')
    .eq('id', user.id)
    .single();

  if (fetchError || !profile) {
    return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
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

  return NextResponse.json({ balance: updated.token_balance, tokensAdded: tokensToAdd });
}
