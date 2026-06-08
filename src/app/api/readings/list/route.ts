import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // 본인 기록만 복호화하여 반환 (get_my_readings RPC, created_at DESC).
  const { data, error } = await supabase.rpc('get_my_readings', { p_limit: 10 });

  if (error) {
    console.error('[/api/readings/list]', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }

  // 기존 응답 shape 유지 (session_id는 RPC가 추가로 반환하지만 무해 — 제거하지 않는다)
  return NextResponse.json({ readings: data ?? [] });
}
