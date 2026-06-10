import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// 공지사항 목록 — 활성 공지만, 고정글 우선·최신순. 공개 읽기(비로그인 포함).
// 작성·수정은 Supabase 대시보드(service role)에서만. 이 라우트는 읽기 전용.
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notices')
    .select('id, kind, title, body, pinned, published_at')
    .eq('is_active', true)
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[notice] select error:', error);
    return NextResponse.json({ error: 'DB_SELECT_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ notices: data ?? [] });
}