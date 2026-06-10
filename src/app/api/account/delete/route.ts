import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

// 회원 탈퇴 — 인증된 본인 계정과 모든 데이터를 영구 삭제한다.
// auth.users 삭제는 service role 권한이 필요하므로 admin 클라이언트를 쓴다.
export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('[account/delete] SUPABASE_SERVICE_ROLE_KEY not set');
    return NextResponse.json({ error: 'SERVER_MISCONFIGURED' }, { status: 500 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const uid = user.id;
  // FK 막힘 방지 — 앱 데이터 먼저 삭제(best-effort) 후 auth 유저 삭제
  await admin.from('readings').delete().eq('user_id', uid);
  await admin.from('payments').delete().eq('user_id', uid);
  await admin.from('code_redemptions').delete().eq('user_id', uid);
  await admin.from('user_consents').delete().eq('user_id', uid);
  await admin.from('profiles').delete().eq('id', uid);

  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) {
    console.error('[account/delete] deleteUser error:', error);
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}