import type { QuestionRow } from "@/lib/supabase/types";

/**
 * Mistakes-mode results.
 *
 * Mistakes Test serves the questions a student previously got wrong (or
 * marked weak). The interesting story is "of the things you used to miss,
 * how many did you actually fix?" — so this builder leans into:
 *   - Recovered count (correct now)
 *   - Still leaking count (wrong again)
 *   - Per-section recovery rate
 *   - Per-difficulty recovery
 *   - Speed (avg + slowest)
 *   - Question-level review with rich metadata
 */
export type MistakesAttempt = {
  question_id: string;
  attempt_number: number;
  is_correct: boolean;
  user_answer: "A" | "B" | "C" | "D" | null;
  hinted: boolean | null;
  retried: boolean | null;
  time_spent_ms: number | null;
  created_at: string;
  question: QuestionRow;
};

export type MistakesReviewItem = {
  question: QuestionRow;
  user_answer: "A" | "B" | "C" | "D" | null;
  is_correct: boolean;
  hinted: boolean;
  time_spent_ms: number;
  index: number;
};

export type MistakesSectionStat = {
  code: string;
  total: number;
  recovered: number;
  accuracy: number; // 0-100
};

export type MistakesDifficultyStat = {
  level: "easy" | "medium" | "hard";
  total: number;
  recovered: number;
  accuracy: number;
};

export type MistakesStats = {
  total: number;
  recovered: number;
  still_leaking: number;
  accuracy_pct: number;
  hint_count: number;
  hint_pct: number;
  total_time_ms: number;
  avg_time_ms: number;
  fastest_correct_ms: number | null;
  slowest_ms: number | null;
  /** Sections with at least one question. Sorted by accuracy ascending (worst first). */
  bySection: MistakesSectionStat[];
  byDifficulty: MistakesDifficultyStat[];
  /** Rolling accuracy in 5-question windows. */
  trend: number[];
  review: MistakesReviewItem[];
};

export function buildMistakesStats(
  attempts: MistakesAttempt[],
): MistakesStats {
  // Mistakes mode is single-shot per question — take attempt #1 only.
  const primary = attempts.filter((a) => a.attempt_number === 1);

  const total = primary.length;
  const recovered = primary.filter((a) => a.is_correct).length;
  const still_leaking = total - recovered;
  const accuracy_pct = total ? Math.round((recovered / total) * 100) : 0;
  const hint_count = primary.filter((a) => a.hinted).length;
  const hint_pct = total ? Math.round((hint_count / total) * 100) : 0;

  const total_time_ms = primary.reduce(
    (acc, a) => acc + (a.time_spent_ms ?? 0),
    0,
  );
  const avg_time_ms = total ? Math.round(total_time_ms / total) : 0;

  const correctTimes = primary
    .filter((a) => a.is_correct && a.time_spent_ms != null)
    .map((a) => a.time_spent_ms as number);
  const fastest_correct_ms = correctTimes.length ? Math.min(...correctTimes) : null;
  const slowest_ms = primary.length
    ? Math.max(...primary.map((a) => a.time_spent_ms ?? 0))
    : null;

  // Section breakdown
  const sectionMap = new Map<string, { total: number; recovered: number }>();
  for (const a of primary) {
    const code = a.question.section_code;
    const cur = sectionMap.get(code) ?? { total: 0, recovered: 0 };
    cur.total += 1;
    if (a.is_correct) cur.recovered += 1;
    sectionMap.set(code, cur);
  }
  const bySection: MistakesSectionStat[] = Array.from(sectionMap.entries())
    .map(([code, v]) => ({
      code,
      total: v.total,
      recovered: v.recovered,
      accuracy: v.total ? Math.round((v.recovered / v.total) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  // Difficulty breakdown
  const diffMap = new Map<
    "easy" | "medium" | "hard",
    { total: number; recovered: number }
  >();
  for (const lvl of ["easy", "medium", "hard"] as const) {
    diffMap.set(lvl, { total: 0, recovered: 0 });
  }
  for (const a of primary) {
    const lvl = (a.question.level ?? "medium") as "easy" | "medium" | "hard";
    const cur = diffMap.get(lvl)!;
    cur.total += 1;
    if (a.is_correct) cur.recovered += 1;
  }
  const byDifficulty: MistakesDifficultyStat[] = (
    ["easy", "medium", "hard"] as const
  ).map((lvl) => {
    const v = diffMap.get(lvl)!;
    return {
      level: lvl,
      total: v.total,
      recovered: v.recovered,
      accuracy: v.total ? Math.round((v.recovered / v.total) * 100) : 0,
    };
  });

  // Rolling 5-question accuracy trend
  const trend: number[] = [];
  const windowSize = 5;
  for (let i = 0; i < primary.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const slice = primary.slice(start, i + 1);
    const correct = slice.filter((a) => a.is_correct).length;
    trend.push(Math.round((correct / slice.length) * 100));
  }

  const review: MistakesReviewItem[] = primary.map((a, i) => ({
    question: a.question,
    user_answer: a.user_answer,
    is_correct: a.is_correct,
    hinted: !!a.hinted,
    time_spent_ms: a.time_spent_ms ?? 0,
    index: i,
  }));

  return {
    total,
    recovered,
    still_leaking,
    accuracy_pct,
    hint_count,
    hint_pct,
    total_time_ms,
    avg_time_ms,
    fastest_correct_ms,
    slowest_ms,
    bySection,
    byDifficulty,
    trend,
    review,
  };
}
