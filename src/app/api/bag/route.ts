import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

type ReadingRow = {
  id: string;
  created_at: string;
  question_text: string;
  reading_type: string;
  reading_content: string;
  session_id: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // 로그인 경로(provider) — app_metadata 우선, 없으면 identities, 기본 email
  const provider =
    (user.app_metadata?.provider as string | undefined) ||
    user.identities?.[0]?.provider ||
    'email';

  // 토큰 잔액
  const { data: profile } = await supabase
    .from('profiles')
    .select('token_balance, is_admin')
    .eq('id', user.id)
    .single();

  // 리딩 기록 (세션 그룹화를 위해 넉넉히 가져온 뒤 묶는다)
  // Vault+pgcrypto 복호화 RPC. DESC로 반환되므로 ASC 그룹화를 위해 reverse 한다.
  const { data: readingRowsDesc } = await supabase.rpc('get_my_readings', { p_limit: 200 });
  const readingRows = (readingRowsDesc ?? []).slice().reverse() as ReadingRow[];

  // session_id로 그룹화: 한 스프레드의 최초질문 + 꼬리질문을 하나로 묶는다.
  // session_id가 없는 옛 기록은 각 행을 단독 그룹으로 처리.
  const groups = new Map<string, ReadingRow[]>();
  for (const r of readingRows) {
    const key = r.session_id ?? `solo-${r.id}`;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  const SEP = `\n\n${'─'.repeat(28)}\n\n`;
  const readingSessions = Array.from(groups.values())
    .map(rows => {
      // rows는 created_at 오름차순. 첫 행 = 최초질문.
      const first = rows[0];
      const last = rows[rows.length - 1];
      return {
        id: first.id,                       // 솔로(세션 없는) 기록 삭제용
        session_id: first.session_id,       // 스프레드 전체 삭제용
        created_at: first.created_at,       // 스프레드 시작 시각
        lastAt: last.created_at,            // 정렬용 (최근 활동)
        question_text: first.question_text, // 최초질문
        reading_type: first.reading_type,
        count: rows.length,                 // 묶인 리딩 수(최초+꼬리)
        reading_content: rows.map(r => r.reading_content).filter(Boolean).join(SEP),
      };
    })
    // 최근 활동순으로 정렬 후 최대 10개
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
    .slice(0, 10);

  // 결제 내역 (3년 이내, 최신순)
  const { data: payments } = await supabase
    .from('payments')
    .select('id, created_at, amount, tokens_added, package_name')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  return NextResponse.json({
    email: user.email ?? '',
    provider,
    tokenBalance: profile?.token_balance ?? 0,
    isAdmin: profile?.is_admin ?? false,
    readingSessions,
    payments: payments ?? [],
  });
}

// 기록(스프레드) 삭제 — [제거] 버튼.
// session_id가 있으면 그 스프레드의 모든 행을, 없으면 solo 행(id)을 삭제한다.
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: { sessionId?: string | null; id?: string } = {};
  try { body = await req.json(); } catch { /* 빈 본문 */ }

  const query = supabase.from('readings').delete().eq('user_id', user.id);
  if (body.sessionId) {
    query.eq('session_id', body.sessionId);
  } else if (body.id) {
    query.eq('id', body.id);
  } else {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
