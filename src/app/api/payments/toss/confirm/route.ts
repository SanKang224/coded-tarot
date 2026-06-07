import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

// packageId → 토큰 수 / 상품명
const PACKAGES: Record<number, { tokens: number; name: string }> = {
  1: { tokens: 3,  name: 'CODED TAROT 3토큰'  },
  2: { tokens: 15, name: 'CODED TAROT 15토큰' },
  3: { tokens: 30, name: 'CODED TAROT 30토큰' },
};

// orderId 형식: ct-{packageId}-{timestamp}
function parsePackageId(orderId: string): number | null {
  const parts = orderId.split('-');
  // ct, {packageId}, {timestamp}
  if (parts.length < 3 || parts[0] !== 'ct') return null;
  const id = parseInt(parts[1], 10);
  return Number.isNaN(id) ? null : id;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json();
  const { paymentKey, orderId, amount } = body as {
    paymentKey?: string;
    orderId?: string;
    amount?: number;
  };

  if (!paymentKey || !orderId || typeof amount !== 'number') {
    return NextResponse.json({ error: 'INVALID_PARAMS' }, { status: 400 });
  }

  const packageId = parsePackageId(orderId);
  const pkg = packageId !== null ? PACKAGES[packageId] : null;
  if (!pkg) {
    return NextResponse.json({ error: 'INVALID_ORDER_ID' }, { status: 400 });
  }

  // 멱등성: 이미 처리된 orderId면 현재 잔액만 반환
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('toss_order_id', orderId)
    .maybeSingle();

  if (existing) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('token_balance')
      .eq('id', user.id)
      .single();
    return NextResponse.json({
      tokensAdded: pkg.tokens,
      balance: profile?.token_balance ?? 0,
      alreadyProcessed: true,
    });
  }

  // Toss Payments 결제 승인 API 호출
  const secretKey = process.env.TOSS_SECRET_KEY!;
  const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');

  let tossData: Record<string, unknown>;
  try {
    const tossRes = await fetch(TOSS_CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    tossData = await tossRes.json();

    if (!tossRes.ok) {
      console.error('[toss/confirm] Toss API error:', tossData);
      return NextResponse.json(
        { error: (tossData as { message?: string }).message ?? 'TOSS_CONFIRM_FAILED' },
        { status: tossRes.status }
      );
    }
  } catch (e) {
    console.error('[toss/confirm] fetch error:', e);
    return NextResponse.json({ error: 'TOSS_API_UNREACHABLE' }, { status: 502 });
  }

  // 금액 검증
  if ((tossData as { totalAmount?: number }).totalAmount !== amount) {
    console.error('[toss/confirm] amount mismatch', tossData);
    return NextResponse.json({ error: 'AMOUNT_MISMATCH' }, { status: 400 });
  }

  // 프로필 조회
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('token_balance, is_admin')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
  }

  const isAdmin = profile.is_admin ?? false;
  const oldBalance = profile.token_balance ?? 0;
  const newBalance = isAdmin ? oldBalance : oldBalance + pkg.tokens;

  // payments 레코드 삽입
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 3);

  const { error: insertErr } = await supabase.from('payments').insert({
    user_id: user.id,
    amount,
    tokens_added: pkg.tokens,
    package_name: pkg.name,
    expires_at: expiresAt.toISOString(),
    toss_order_id: orderId,
    toss_payment_key: paymentKey,
  });

  if (insertErr) {
    // UNIQUE 충돌 = 동시 재시도 → 멱등 처리
    if (insertErr.code === '23505') {
      return NextResponse.json({
        tokensAdded: pkg.tokens,
        balance: oldBalance,
        alreadyProcessed: true,
      });
    }
    console.error('[toss/confirm] insert error:', insertErr);
    return NextResponse.json({ error: 'DB_INSERT_FAILED' }, { status: 500 });
  }

  // 토큰 잔액 업데이트
  if (!isAdmin) {
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ token_balance: newBalance })
      .eq('id', user.id);

    if (updateErr) {
      console.error('[toss/confirm] update error:', updateErr);
      return NextResponse.json({ error: 'TOKEN_UPDATE_FAILED' }, { status: 500 });
    }
  }

  return NextResponse.json({
    tokensAdded: pkg.tokens,
    balance: newBalance,
  });
}
