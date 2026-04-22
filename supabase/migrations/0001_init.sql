-- AI Tutor: initial schema
-- Run in Supabase SQL editor. Idempotent where possible.

create extension if not exists "pgcrypto";

-- =========================================================
-- PROFILES (1:1 with auth.users)
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  target_exam_date date,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are self-readable" on public.profiles;
create policy "profiles are self-readable" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles self-insert" on public.profiles;
create policy "profiles self-insert" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles self-update" on public.profiles;
create policy "profiles self-update" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- SECTIONS & TOPICS (content catalog)
-- =========================================================
create table if not exists public.sections (
  code text primary key,
  title text not null,
  description text,
  grp text not null check (grp in ('National', 'State')),
  order_index int not null
);

alter table public.sections enable row level security;
drop policy if exists "sections readable by authed" on public.sections;
create policy "sections readable by authed" on public.sections
  for select using (auth.role() = 'authenticated');

insert into public.sections (code, title, grp, order_index) values
  ('A1', 'Property Ownership', 'National', 1),
  ('A2', 'Land Use Controls & Regulations', 'National', 2),
  ('A3', 'Valuation & Market Analysis', 'National', 3),
  ('A4', 'Financing', 'National', 4),
  ('A5', 'General Principles of Agency', 'National', 5),
  ('A6', 'Property Disclosures', 'National', 6),
  ('B1', 'SC License Law & Commission Rules', 'State', 7),
  ('B2', 'SC Agency Relationships', 'State', 8),
  ('B3', 'SC Contracts & Purchase Agreements', 'State', 9),
  ('B4', 'SC Property Management & Leasing', 'State', 10),
  ('B5', 'SC Fair Housing & Ethics', 'State', 11),
  ('B6', 'SC Closing, Settlement & Escrow', 'State', 12)
on conflict (code) do nothing;

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  section_code text not null references public.sections(code) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

alter table public.topics enable row level security;
drop policy if exists "topics readable by authed" on public.topics;
create policy "topics readable by authed" on public.topics
  for select using (auth.role() = 'authenticated');

-- =========================================================
-- QUESTIONS
-- =========================================================
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  section_code text not null references public.sections(code) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  level text not null default 'medium' check (level in ('easy', 'medium', 'hard')),
  prompt text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option char(1) not null check (correct_option in ('A','B','C','D')),
  hint text,
  explanation text,
  source text,
  pool text not null default 'standard' check (pool in ('standard', 'final_holdout')),
  created_at timestamptz not null default now()
);

create index if not exists questions_section_idx on public.questions(section_code);
create index if not exists questions_pool_idx on public.questions(pool);

alter table public.questions enable row level security;
drop policy if exists "questions readable by authed" on public.questions;
create policy "questions readable by authed" on public.questions
  for select using (auth.role() = 'authenticated');

-- =========================================================
-- SESSIONS
-- =========================================================
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('assessment', 'practice', 'mistakes', 'mock', 'final')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score_pct numeric,
  duration_ms int,
  config jsonb default '{}'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'finished', 'abandoned'))
);

create index if not exists sessions_user_idx on public.sessions(user_id, started_at desc);
create index if not exists sessions_user_mode_idx on public.sessions(user_id, mode, started_at desc);

alter table public.sessions enable row level security;
drop policy if exists "sessions self" on public.sessions;
create policy "sessions self" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================
-- ATTEMPTS (append-only)
-- =========================================================
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  mode text not null,
  user_answer char(1) check (user_answer in ('A','B','C','D')),
  is_correct boolean not null default false,
  hinted boolean not null default false,
  retried boolean not null default false,
  time_spent_ms int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists attempts_user_idx on public.attempts(user_id, created_at desc);
create index if not exists attempts_session_idx on public.attempts(session_id);
create index if not exists attempts_question_idx on public.attempts(question_id);

alter table public.attempts enable row level security;
drop policy if exists "attempts self" on public.attempts;
create policy "attempts self" on public.attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================
-- CHAT
-- =========================================================
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_threads_user_idx on public.chat_threads(user_id, updated_at desc);

alter table public.chat_threads enable row level security;
drop policy if exists "chat_threads self" on public.chat_threads;
create policy "chat_threads self" on public.chat_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  question_id uuid references public.questions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx on public.chat_messages(thread_id, created_at);

alter table public.chat_messages enable row level security;
drop policy if exists "chat_messages self" on public.chat_messages;
create policy "chat_messages self" on public.chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================
-- VIEWS: mastery + mistakes + streak
-- =========================================================

-- Per-user × section accuracy (all time, plus last-30 window)
create or replace view public.v_user_section_mastery as
select
  a.user_id,
  q.section_code,
  count(*) as total,
  sum(case when a.is_correct then 1 else 0 end)::int as correct,
  round(100.0 * sum(case when a.is_correct then 1 else 0 end) / nullif(count(*), 0), 1) as accuracy
from public.attempts a
join public.questions q on q.id = a.question_id
group by a.user_id, q.section_code;

-- Latest wrong per question, times_wrong, and resolved flag (2 correct in a row)
create or replace view public.v_user_mistakes as
with latest as (
  select
    a.user_id,
    a.question_id,
    max(a.created_at) filter (where a.is_correct = false) as last_wrong_at,
    count(*) filter (where a.is_correct = false) as times_wrong,
    count(*) filter (where a.is_correct = true) as times_correct
  from public.attempts a
  group by a.user_id, a.question_id
)
select
  l.user_id,
  l.question_id,
  l.last_wrong_at,
  l.times_wrong,
  l.times_correct,
  (l.times_correct >= 2 and l.times_correct > l.times_wrong) as resolved
from latest l
where l.times_wrong > 0;

-- Daily attempt counts for streaks/heatmap
create or replace view public.v_user_daily_activity as
select
  user_id,
  date_trunc('day', created_at)::date as day,
  count(*) as attempts,
  sum(case when is_correct then 1 else 0 end)::int as correct
from public.attempts
group by user_id, day;

-- =========================================================
-- HELPERS
-- =========================================================
create or replace function public.random_questions(
  p_section text default null,
  p_limit int default 10,
  p_pool text default 'standard'
)
returns setof public.questions
language sql
stable
security definer
as $$
  select *
  from public.questions
  where pool = p_pool
    and (p_section is null or section_code = p_section)
  order by random()
  limit p_limit;
$$;

grant execute on function public.random_questions(text, int, text) to authenticated;
