import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

const PERMANENT_BAN = '876000h'; // ≈100년 = 영구 차단

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: 'SERVER_MISCONFIGURED' }, { status: 500 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const uid = user.id;
  let mode: 'withdraw' | 'abandon' = 'withdraw';
  let reason: string | null = null;
  try { const b = await req.json(); mode = b?.mode === 'abandon' ? 'abandon' : 'withdraw'; reason = b?.reason ?? null; } catch { /* body 없어도 됨 */ }

  // ── 가입 중도 이탈(결제·동의 전) → 완전 삭제(재가입 허용) ──────────
  if (mode === 'abandon') {
    await admin.from('readings').delete().eq('user_id', uid);
    await admin.from('code_redemptions').delete().eq('user_id', uid);
    await admin.from('user_consents').delete().eq('user_id', uid);
    await admin.from('profiles').delete().eq('id', uid);
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
    return NextResponse.json({ ok: true, mode });
  }

  // ── 정식 회원 탈퇴 → 소프트 삭제 + 비식별화 + 영구 차단 ────────────
  const email = user.email ?? '';
  const maskedEmail = email ? email.replace(/^(.).*(@.*)$/, (_m, a, d) => `${a}****${d}`) : null;

  // 1) 탈퇴 감사/격리 레코드 (user_id 매핑 보존)
  await admin.from('withdrawn_members').upsert({
    user_id: uid, reason, masked_email: maskedEmail, withdrawn_at: new Date().toISOString(),
  });

  // 2) 개인 콘텐츠 파기(법정 보존 대상 아님): 리딩 기록·코드 사용 이력
  await admin.from('readings').delete().eq('user_id', uid);
  await admin.from('code_redemptions').delete().eq('user_id', uid);

  // 3) profiles 소프트 삭제 + 잔여 토큰 소멸
  await admin.from('profiles').update({
    deleted_at: new Date().toISOString(), deleted_reason: reason, token_balance: 0,
  }).eq('id', uid);

  // 4) 결제 이력(payments) · 결제 동의 로그(user_consents) → 보존 (건드리지 않음)

  // 5) auth.users 비식별화 + 영구 차단 (재로그인/재가입 차단, PII 스크럽)
  const { error } = await admin.auth.admin.updateUserById(uid, {
    email: `deleted+${uid}@deleted.witchsterminal.dev`,
    user_metadata: {},   // 소셜에서 받은 이름/프로필 제거
    app_metadata: {},
    ban_duration: PERMANENT_BAN,
  });
  if (error) return NextResponse.json({ error: 'WITHDRAW_FAILED' }, { status: 500 });

  return NextResponse.json({ ok: true, mode });
}