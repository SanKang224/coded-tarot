-- ─────────────────────────────────────────────────────────────
-- CODED TAROT — Supabase DB Schema
-- Supabase 대시보드 > SQL Editor 에서 실행
-- ─────────────────────────────────────────────────────────────

-- 1. profiles 테이블 (auth.users 에 연결)
create table if not exists public.profiles (
  id           uuid references auth.users on delete cascade primary key,
  token_balance integer not null default 3,
  is_admin     boolean not null default false,
  created_at   timestamptz default now()
);

-- is_admin 컬럼 추가 (이미 테이블이 있는 경우)
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 2. RLS 활성화
alter table public.profiles enable row level security;

-- 3. 본인 프로필만 읽기/수정 가능
create policy "select_own_profile" on public.profiles
  for select using (auth.uid() = id);

create policy "update_own_profile" on public.profiles
  for update using (auth.uid() = id);

-- 4. 회원가입 시 profiles 자동 생성 (3토큰 지급)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, token_balance)
  values (new.id, 3)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
