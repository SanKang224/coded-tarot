import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// 회원가입 필수 동의 기록. 게이트는 로그인 전(비인증)에 통과하므로,
// 클라이언트가 sessionStorage에 보관했다가 로그인 직후 이 라우트로 플러시한다.
const ALLOWED_TYPES = new Set(['age_14', 'terms', 'privacy']);

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: { consents?: Array<{ type?: string; version?: string }>; agreedAt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.consents) || body.consents.length === 0) {
    return NextResponse.json({ error: 'NO_CONSENTS' }, { status: 400 });
  }

  // agreedAt는 게이트에서 [동의하고 계속]을 누른 실제 시각. 유효하지 않으면 현재 시각.
  const agreedAt = body.agreedAt && !Number.isNaN(Date.parse(body.agreedAt))
    ? new Date(body.agreedAt).toISOString()
    : new Date().toISOString();
  const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null;

  const rows = body.consents
    .filter(c => c && typeof c.type === 'string' && ALLOWED_TYPES.has(c.type) && typeof c.version === 'string')
    .map(c => ({
      user_id: user.id,
      consent_type: c.type as string,
      policy_version: c.version as string,
      context: 'signup',
      user_agent: userAgent,
      agreed_at: agreedAt,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: 'NO_VALID_CONSENTS' }, { status: 400 });
  }

  const { error } = await supabase.from('user_consents').insert(rows);
  if (error) {
    console.error('[consent] insert error:', error);
    return NextResponse.json({ error: 'DB_INSERT_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recorded: rows.length });
}
