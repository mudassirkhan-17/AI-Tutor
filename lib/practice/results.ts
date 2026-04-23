import type { QuestionRow, ResultLabel } from "@/lib/supabase/types";

/**
 * Practice results stats. Built from raw `attempts` rows joined with the
 * source question. Designed to be dense — every field below has a card,
 * chart, or sentence on the practice results page.
 *
 * Notes on label semantics (mirrors the runner):
 *   - mastered  : answered correctly on first primary attempt.
 *   - soft_miss : missed primary, then answered the AI sibling correctly.
 *   - hard_miss : missed primary AND missed sibling (or no sibling).
 *
 * `coached` is a per-attempt boolean that means the student opened
 * "Let's talk it out" before submitting. It does not reveal the letter,
 * but a coached-correct attempt is still weaker signal than solo.
 */
export type PracticeAttempt = {
  question_id: string;
  attempt_number: number;
  is_correct: boolean;
  result_label: ResultLabel | null;
  user_answer: "A" | "B" | "C" | "D" | null;
  hinted: boolean | null;
  retried: boolean | null;
  coached: boolean | null;
  is_sibling: boolean | null;
  parent_attempt_id: string | null;
  time_spent_ms: number | null;
  created_at: string;
  question: QuestionRow;
};

export type PracticeReviewItem = {
  question: QuestionRow;
  user_answer: "A" | "B" | "C" | "D" | null;
  is_correct: boolean;
  label: ResultLabel | null;
  coached: boolean;
  hinted: boolean;
  /** True when the student missed the primary AND missed the sibling. */
  hard: boolean;
  time_spent_ms: number;
  index: number; // chronological order in the run
};

export type SectionStat = {
  code: string;
  total: number;
  correct: number;
  accuracy: number; // 0-100
};

export type DifficultyStat = {
  level: "easy" | "medium" | "hard";
  total: number;
  correct: number;
  accuracy: number;
};

export type PracticeStats = {
  total: number;
  mastered: number;
  soft: number;
  hard: number;
  /** mastered + soft (the "reach" headline). */
  reach: number;
  /** Strict score: mastered / total. */
  strict_pct: number;
  /** mastered + soft / total. */
  reach_pct: number;
  /** First-try accuracy (independent of recovery): primary attempts correct. */
  first_try_pct: number;

  coached_count: number;
  /** Of mastered/soft outcomes, how many were coached at any point. */
  coached_pct: number;

  hint_count: number;
  hint_pct: number;

  sibling_attempts: number;
  sibling_recovered: number;
  /** sibling_recovered / sibling_attempts (the "recovery" rate). */
  recovery_pct: number;

  total_time_ms: number;
  avg_time_ms: number;
  fastest_correct_ms: number | null;
  slowest_ms: number | null;

  bySection: SectionStat[];
  byDifficulty: DifficultyStat[];
  /** Rolling primary accuracy as the run progressed (length === total). */
  trend: number[];

  review: PracticeReviewItem[];
};

function freshSection(code: string): SectionStat {
  return { code, total: 0, correct: 0, accuracy: 0 };
}

function freshDifficulty(level: DifficultyStat["level"]): DifficultyStat {
  return { level, total: 0, correct: 0, accuracy: 0 };
}

export function buildPracticeStats(attempts: PracticeAttempt[]): PracticeStats {
  // Split primaries vs siblings.
  const primaries = attempts.filter((a) => !a.is_sibling);
  const siblings = attempts.filter((a) => a.is_sibling);

  // Group primaries by question to get the *first* primary per question.
  // We treat the first primary as the "true" first-try outcome for KPI math
  // and for the trend chart so a flurry of late retries doesn't skew it.
  const firstPrimaryByQ = new Map<string, PracticeAttempt>();
  for (const p of primaries) {
    if (!firstPrimaryByQ.has(p.question_id)) firstPrimaryByQ.set(p.question_id, p);
  }
  // Final outcome per question = whichever attempt actually carries
  // result_label (the runner stamps this on the last meaningful attempt
  // for the slot — primary if mastered, sibling if soft, or primary on
  // hard_miss after a failed sibling).
  const finalByQ = new Map<string, PracticeAttempt>();
  for (const a of attempts) {
    if (a.result_label) finalByQ.set(a.question_id, a);
  }
  // Coached flag is set on the primary attempt; OR-collapse in case
  // multiple primaries exist for the same question (defensive).
  const coachedByQ = new Map<string, boolean>();
  const hintedByQ = new Map<string, boolean>();
  for (const p of primaries) {
    coachedByQ.set(p.question_id, !!p.coached || !!coachedByQ.get(p.question_id));
    hintedByQ.set(p.question_id, !!p.hinted || !!hintedByQ.get(p.question_id));
  }

  // Walk every distinct question (deterministic order: chronological by
  // first primary) and assemble outcomes + section/difficulty buckets.
  const seen = new Set<string>();
  const ordered: { qid: string; q: QuestionRow; primary: PracticeAttempt }[] = [];
  for (const p of primaries) {
    if (seen.has(p.question_id)) continue;
    seen.add(p.question_id);
    ordered.push({ qid: p.question_id, q: p.question, primary: p });
  }

  const sectionMap = new Map<string, SectionStat>();
  const diffMap = new Map<DifficultyStat["level"], DifficultyStat>();
  const trend: number[] = [];

  let mastered = 0;
  let soft = 0;
  let hard = 0;
  let firstTryCorrect = 0;
  let cumulative = 0; // running mastered count for trend

  let totalTime = 0;
  let fastestCorrect: number | null = null;
  let slowestAny: number | null = null;

  const review: PracticeReviewItem[] = [];

  ordered.forEach(({ qid, q, primary }, i) => {
    const final = finalByQ.get(qid) ?? primary;
    const label = (final.result_label ?? null) as ResultLabel | null;
    const coached = !!coachedByQ.get(qid);
    const hinted = !!hintedByQ.get(qid);
    const isCorrectOverall =
      label === "mastered" || label === "soft_miss" || final.is_correct;

    if (label === "mastered") mastered++;
    else if (label === "soft_miss") soft++;
    else if (label === "hard_miss") hard++;
    else if (isCorrectOverall) mastered++; // very defensive — shouldn't happen
    else hard++;

    if (primary.is_correct) firstTryCorrect++;

    if (label === "mastered" || primary.is_correct) cumulative++;
    trend.push(Math.round((100 * cumulative) / (i + 1)));

    // Time aggregation across BOTH primary and any sibling for that question.
    const tThis = (primary.time_spent_ms ?? 0)
      + siblings
        .filter((s) => s.parent_attempt_id != null && s.question_id !== qid && false)
        .reduce((acc, s) => acc + (s.time_spent_ms ?? 0), 0);
    // ^ we intentionally don't double-count sibling time per primary — sibling
    // is its own slot with its own time. Compute separately below.
    const tPrimary = primary.time_spent_ms ?? 0;
    totalTime += tPrimary;
    if (primary.is_correct) {
      if (fastestCorrect == null || tPrimary < fastestCorrect) fastestCorrect = tPrimary;
    }
    if (slowestAny == null || tPrimary > slowestAny) slowestAny = tPrimary;
    void tThis;

    // Section + difficulty buckets — we use the FIRST-TRY outcome here
    // because that's what most accurately reflects what the student would
    // have gotten on a real exam without a coach in the room.
    const sec = q.section_code;
    const ss = sectionMap.get(sec) ?? freshSection(sec);
    ss.total += 1;
    if (primary.is_correct) ss.correct += 1;
    ss.accuracy = Math.round((100 * ss.correct) / Math.max(1, ss.total));
    sectionMap.set(sec, ss);

    const ds = diffMap.get(q.level) ?? freshDifficulty(q.level);
    ds.total += 1;
    if (primary.is_correct) ds.correct += 1;
    ds.accuracy = Math.round((100 * ds.correct) / Math.max(1, ds.total));
    diffMap.set(q.level, ds);

    review.push({
      question: q,
      user_answer: final.user_answer ?? primary.user_answer,
      is_correct: isCorrectOverall,
      label,
      coached,
      hinted,
      hard: label === "hard_miss",
      time_spent_ms: tPrimary,
      index: i,
    });
  });

  // Sibling time (separate bucket so totals don't lose it).
  for (const s of siblings) totalTime += s.time_spent_ms ?? 0;

  const total = ordered.length;
  const reach = mastered + soft;

  const sibling_attempts = ordered.filter(
    ({ primary }) => !primary.is_correct,
  ).length;
  const sibling_recovered = soft;

  const coached_count = ordered.filter(({ qid }) => !!coachedByQ.get(qid)).length;
  const hint_count = ordered.filter(({ qid }) => !!hintedByQ.get(qid)).length;

  return {
    total,
    mastered,
    soft,
    hard,
    reach,
    strict_pct: total ? Math.round((100 * mastered) / total) : 0,
    reach_pct: total ? Math.round((100 * reach) / total) : 0,
    first_try_pct: total ? Math.round((100 * firstTryCorrect) / total) : 0,

    coached_count,
    coached_pct: total ? Math.round((100 * coached_count) / total) : 0,
    hint_count,
    hint_pct: total ? Math.round((100 * hint_count) / total) : 0,

    sibling_attempts,
    sibling_recovered,
    recovery_pct: sibling_attempts
      ? Math.round((100 * sibling_recovered) / sibling_attempts)
      : 0,

    total_time_ms: totalTime,
    avg_time_ms: total ? Math.round(totalTime / total) : 0,
    fastest_correct_ms: fastestCorrect,
    slowest_ms: slowestAny,

    bySection: Array.from(sectionMap.values()).sort((a, b) =>
      a.code.localeCompare(b.code),
    ),
    byDifficulty: (["easy", "medium", "hard"] as const).map(
      (lvl) => diffMap.get(lvl) ?? freshDifficulty(lvl),
    ),
    trend,
    review,
  };
}
