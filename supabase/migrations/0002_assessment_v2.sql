-- AI Tutor: Assessment v2 + Concept layer
-- Run AFTER 0001_init.sql in Supabase SQL editor. Idempotent.

-- =========================================================
-- 1. (Reserved — A7–A9 experimental sections were removed; the
--     active bank uses A1–A6 + B1–B6 only.)
-- =========================================================

-- =========================================================
-- 2. CONCEPTS catalog (~100 items, populated by import script)
-- =========================================================
create table if not exists public.concepts (
  id text primary key,                                  -- e.g. "A5.fiduciary_duties_oldcar"
  section_code text not null references public.sections(code) on delete cascade,
  title text not null,                                  -- human readable
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists concepts_section_idx on public.concepts(section_code);

alter table public.concepts enable row level security;
drop policy if exists "concepts readable by authed" on public.concepts;
create policy "concepts readable by authed" on public.concepts
  for select using (auth.role() = 'authenticated');

-- =========================================================
-- 3. Questions: add concept_id (nullable, falls back to section)
-- =========================================================
alter table public.questions
  add column if not exists concept_id text references public.concepts(id) on delete set null;

create index if not exists questions_concept_idx on public.questions(concept_id);

-- =========================================================
-- 4. Attempts: richer signal for assessment v2
--    attempt_number: 1 (first try) or 2 (after hint)
--    result_label  : mastered | lucky | soft_miss | hard_miss
-- =========================================================
alter table public.attempts
  add column if not exists attempt_number int not null default 1,
  add column if not exists result_label text;

create index if not exists attempts_label_idx on public.attempts(user_id, result_label);

-- =========================================================
-- 5. Sessions: persist tutor letter + summary stats
--    (stored in config jsonb to avoid breaking changes)
-- =========================================================
-- nothing to alter; config jsonb already exists. Tutor letter goes under
-- config -> 'tutor_letter' (text), and per-section/per-concept summaries
-- under config -> 'summary'.

-- =========================================================
-- 6. View: per-user × concept mastery (counts only the FIRST attempt
--    on each (user, question, session). For assessment v2 the "is_correct"
--    of attempt_number=1 already maps to mastered+lucky vs soft+hard.)
-- =========================================================
create or replace view public.v_user_concept_mastery as
with first_attempts as (
  select distinct on (a.user_id, a.session_id, a.question_id)
    a.user_id, a.session_id, a.question_id, a.is_correct, a.result_label
  from public.attempts a
  where a.attempt_number = 1
  order by a.user_id, a.session_id, a.question_id, a.created_at asc
)
select
  fa.user_id,
  q.concept_id,
  q.section_code,
  count(*) as total,
  sum(case when fa.is_correct then 1 else 0 end)::int as correct,
  sum(case when fa.result_label = 'soft_miss' then 1 else 0 end)::int as soft_miss,
  sum(case when fa.result_label = 'hard_miss' then 1 else 0 end)::int as hard_miss,
  sum(case when fa.result_label = 'lucky' then 1 else 0 end)::int as lucky,
  sum(case when fa.result_label = 'mastered' then 1 else 0 end)::int as mastered,
  round(100.0 * sum(case when fa.is_correct then 1 else 0 end) / nullif(count(*), 0), 1) as accuracy
from first_attempts fa
join public.questions q on q.id = fa.question_id
where q.concept_id is not null
group by fa.user_id, q.concept_id, q.section_code;

-- =========================================================
-- 7. Helper: balanced sample of questions per section
--    Returns up to p_easy easy + p_medium medium + p_hard hard
--    questions for a section, randomly ordered.
-- =========================================================
create or replace function public.balanced_section_sample(
  p_section text,
  p_easy int default 5,
  p_medium int default 5,
  p_hard int default 5,
  p_pool text default 'standard'
)
returns setof public.questions
language sql
stable
security definer
as $$
  (select * from public.questions
   where section_code = p_section and pool = p_pool and level = 'easy'
   order by random() limit p_easy)
  union all
  (select * from public.questions
   where section_code = p_section and pool = p_pool and level = 'medium'
   order by random() limit p_medium)
  union all
  (select * from public.questions
   where section_code = p_section and pool = p_pool and level = 'hard'
   order by random() limit p_hard);
$$;

grant execute on function public.balanced_section_sample(text, int, int, int, text) to authenticated;
