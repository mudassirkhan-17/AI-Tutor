-- AI Tutor: Practice v3 — Socratic Coach Chat.
-- Adds a `coached` flag on attempts so we can separate "solved with the
-- tutor's help" from true mastery. The chat itself never reveals the
-- correct letter (server-side output filter + Socratic prompt), but a
-- coached-correct attempt is still weaker signal than a solo-correct one
-- and we want to surface that distinction in the report and KPIs.
--
-- Run AFTER 0003_practice_siblings.sql in the Supabase SQL editor.
-- Idempotent.

-- =========================================================
-- 1. attempts.coached
--    True iff the student opened "Let's talk it out" on this
--    question before submitting. Defaults to false so the
--    column is safe to add to live tables.
-- =========================================================
alter table public.attempts
  add column if not exists coached boolean not null default false;

create index if not exists attempts_coached_idx
  on public.attempts(user_id, coached)
  where coached = true;

-- =========================================================
-- 2. v_user_section_mastery — unchanged shape, but we now
--    expose a `solo_accuracy` next to the existing accuracy
--    so the dashboard can show "looks good vs really good".
--    `accuracy` keeps existing semantics (all non-sibling
--    attempts, coached or not) so nothing downstream breaks.
-- =========================================================
create or replace view public.v_user_section_mastery as
select
  a.user_id,
  q.section_code,
  count(*) as total,
  sum(case when a.is_correct then 1 else 0 end)::int as correct,
  round(100.0 * sum(case when a.is_correct then 1 else 0 end) / nullif(count(*), 0), 1) as accuracy,
  sum(case when coalesce(a.coached, false) = false then 1 else 0 end)::int as solo_total,
  sum(case when coalesce(a.coached, false) = false and a.is_correct then 1 else 0 end)::int as solo_correct,
  round(
    100.0 * sum(case when coalesce(a.coached, false) = false and a.is_correct then 1 else 0 end)
    / nullif(sum(case when coalesce(a.coached, false) = false then 1 else 0 end), 0),
    1
  ) as solo_accuracy
from public.attempts a
join public.questions q on q.id = a.question_id
where coalesce(a.is_sibling, false) = false
group by a.user_id, q.section_code;
