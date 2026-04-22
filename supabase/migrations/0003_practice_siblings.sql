-- AI Tutor: Practice v2 — AI-generated "sibling" questions.
-- Run AFTER 0002_assessment_v2.sql in the Supabase SQL editor. Idempotent.

-- =========================================================
-- 1. questions: track AI-generated siblings + their parent.
--    parent_question_id lets us reuse siblings across users
--    (future) and lets us exclude them from the "fresh" pools
--    in pick-questions.ts so learners don't see a sibling as a
--    primary practice item.
-- =========================================================
alter table public.questions
  add column if not exists parent_question_id uuid
    references public.questions(id) on delete set null,
  add column if not exists is_ai_generated boolean not null default false;

create index if not exists questions_parent_idx
  on public.questions(parent_question_id)
  where parent_question_id is not null;

create index if not exists questions_ai_idx
  on public.questions(is_ai_generated)
  where is_ai_generated = true;

-- =========================================================
-- 2. attempts: mark sibling attempts + link them back to the
--    original attempt. The sibling answer does NOT get its own
--    result_label — it adjusts the parent attempt's label to
--    soft_miss (sibling right) or hard_miss (sibling wrong).
-- =========================================================
alter table public.attempts
  add column if not exists is_sibling boolean not null default false,
  add column if not exists parent_attempt_id uuid
    references public.attempts(id) on delete set null;

create index if not exists attempts_parent_idx
  on public.attempts(parent_attempt_id)
  where parent_attempt_id is not null;

-- =========================================================
-- 3. v_user_section_mastery — exclude sibling attempts so
--    accuracy reflects first-try performance on the real bank.
--    (Sibling outcomes are already captured via the parent's
--    result_label.)
-- =========================================================
create or replace view public.v_user_section_mastery as
select
  a.user_id,
  q.section_code,
  count(*) as total,
  sum(case when a.is_correct then 1 else 0 end)::int as correct,
  round(100.0 * sum(case when a.is_correct then 1 else 0 end) / nullif(count(*), 0), 1) as accuracy
from public.attempts a
join public.questions q on q.id = a.question_id
where coalesce(a.is_sibling, false) = false
group by a.user_id, q.section_code;

-- =========================================================
-- 4. v_user_mistakes — sibling attempts should not mask or
--    re-create the mistake row for the parent question.
-- =========================================================
create or replace view public.v_user_mistakes as
with latest as (
  select
    a.user_id,
    a.question_id,
    max(a.created_at) filter (where a.is_correct = false) as last_wrong_at,
    count(*) filter (where a.is_correct = false) as times_wrong,
    count(*) filter (where a.is_correct = true) as times_correct
  from public.attempts a
  where coalesce(a.is_sibling, false) = false
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

-- =========================================================
-- 5. v_user_daily_activity — daily streak/heatmap still
--    counts every attempt (including siblings) as real work.
-- =========================================================
-- (kept as-is; siblings are still practice effort.)

-- =========================================================
-- 6. v_user_concept_mastery — drop "lucky". Historical rows
--    with result_label='lucky' are rolled into `mastered` so
--    counts add up to total and the report doesn't break.
--
--    NOTE: we DROP-then-CREATE because Postgres's
--    `create or replace view` refuses to drop or reorder
--    existing columns — and we're removing the `lucky` column
--    from the prior v2 definition.
-- =========================================================
drop view if exists public.v_user_concept_mastery;

create view public.v_user_concept_mastery as
with first_attempts as (
  select distinct on (a.user_id, a.session_id, a.question_id)
    a.user_id, a.session_id, a.question_id, a.is_correct, a.result_label
  from public.attempts a
  where a.attempt_number = 1
    and coalesce(a.is_sibling, false) = false
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
  sum(case when fa.result_label in ('mastered','lucky') then 1 else 0 end)::int as mastered,
  round(100.0 * sum(case when fa.is_correct then 1 else 0 end) / nullif(count(*), 0), 1) as accuracy
from first_attempts fa
join public.questions q on q.id = fa.question_id
where q.concept_id is not null
group by fa.user_id, q.concept_id, q.section_code;
