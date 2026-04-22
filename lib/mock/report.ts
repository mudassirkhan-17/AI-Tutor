import { SECTIONS } from "@/lib/constants";
import type {
  SectionRow,
  Verdict,
  DifficultyBlock,
  Calibration,
} from "@/components/mock/mock-report";

/**
 * Stored going in by pickMockQuestions(); mirrors MockComposition type.
 * We re-declare to avoid pulling a server-only import into a client bundle.
 */
type StoredCompositionSection = {
  code: string;
  title: string;
  group: "National" | "State";
  questions: number;
  weaknessScore: number;
  sampledAttempts: number;
  accuracyPct: number;
};

type StoredComposition = {
  sectionBreakdown?: StoredCompositionSection[];
  nationalTotal?: number;
  stateTotal?: number;
  totalQuestions?: number;
  difficultyCounts?: { easy: number; medium: number; hard: number };
};

type AttemptWithQuestion = {
  is_correct: boolean;
  question: {
    section_code: string;
    level: "easy" | "medium" | "hard";
  };
};

/**
 * Compute the full Mock Exam report payload from stored session config + attempts.
 *
 * Pure functions only — no I/O. Easy to unit-test later.
 */
export function buildMockReport({
  attempts,
  composition,
  passPct,
}: {
  attempts: AttemptWithQuestion[];
  composition: StoredComposition | null;
  passPct: number;
}): {
  sections: SectionRow[];
  nationalCorrect: number;
  nationalTotal: number;
  stateCorrect: number;
  stateTotal: number;
  difficulty: DifficultyBlock;
  verdict: Verdict;
  calibration: Calibration;
} {
  const priorBySection = new Map<string, StoredCompositionSection>();
  for (const s of composition?.sectionBreakdown ?? []) {
    priorBySection.set(s.code, s);
  }

  // Actual per-section aggregation from attempts.
  const actual = new Map<string, { total: number; correct: number }>();
  const difficulty: DifficultyBlock = {
    easy: { total: 0, correct: 0 },
    medium: { total: 0, correct: 0 },
    hard: { total: 0, correct: 0 },
  };

  for (const a of attempts) {
    const code = a.question.section_code;
    const slot = actual.get(code) ?? { total: 0, correct: 0 };
    slot.total += 1;
    if (a.is_correct) slot.correct += 1;
    actual.set(code, slot);

    const lvl = a.question.level;
    if (lvl && difficulty[lvl]) {
      difficulty[lvl].total += 1;
      if (a.is_correct) difficulty[lvl].correct += 1;
    }
  }

  let nationalCorrect = 0;
  let nationalTotal = 0;
  let stateCorrect = 0;
  let stateTotal = 0;

  const sections: SectionRow[] = SECTIONS.map((s) => {
    const act = actual.get(s.code) ?? { total: 0, correct: 0 };
    const accuracyPct =
      act.total > 0 ? Math.round((act.correct / act.total) * 100) : 0;

    if (s.group === "National") {
      nationalCorrect += act.correct;
      nationalTotal += act.total;
    } else {
      stateCorrect += act.correct;
      stateTotal += act.total;
    }

    const prior = priorBySection.get(s.code);
    const priorSampleSize = prior?.sampledAttempts ?? 0;
    // Prior accuracy is only meaningful if we had real samples going in.
    const priorAccuracyPct =
      prior && priorSampleSize >= 3 ? prior.accuracyPct : null;

    // Recovery points: how many more points this section could yield if
    // it was lifted to passPct accuracy. Used for the "shortest path" verdict.
    const targetCorrect = Math.ceil((act.total * passPct) / 100);
    const recoverPoints = Math.max(0, targetCorrect - act.correct);

    return {
      code: s.code,
      title: s.title,
      group: s.group as "National" | "State",
      total: act.total,
      correct: act.correct,
      accuracyPct,
      priorAccuracyPct,
      priorSampleSize,
      recoverPoints,
    };
  });

  const total = nationalTotal + stateTotal;
  const correct = nationalCorrect + stateCorrect;
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const verdict = buildVerdict({ sections, scorePct, total, correct, passPct });
  const calibration = buildCalibration({ sections, actualScore: scorePct });

  return {
    sections,
    nationalCorrect,
    nationalTotal,
    stateCorrect,
    stateTotal,
    difficulty,
    verdict,
    calibration,
  };
}

/**
 * Honest next-step verdict.
 *
 * - pass:   margin = scorePct - passPct; list 2 lowest sections to tighten before Final.
 * - close:  gap ≤ 5 questions; list the *smallest* set of weak sections whose
 *           recovery points would have closed the gap.
 * - far:    gap > 5; surface top-3 lowest-accuracy sections as "biggest leaks".
 */
function buildVerdict({
  sections,
  scorePct,
  total,
  correct,
  passPct,
}: {
  sections: SectionRow[];
  scorePct: number;
  total: number;
  correct: number;
  passPct: number;
}): Verdict {
  if (total === 0) {
    return { kind: "far", gap: 0, leaks: [] };
  }

  if (scorePct >= passPct) {
    const byAccuracy = [...sections]
      .filter((s) => s.total > 0)
      .sort((a, b) => a.accuracyPct - b.accuracyPct);
    const tighten = byAccuracy
      .slice(0, 2)
      .filter((s) => s.accuracyPct < 85)
      .map((s) => `${s.code} ${s.title}`);
    return {
      kind: "pass",
      margin: scorePct - passPct,
      tighten,
    };
  }

  const needed = Math.ceil((total * passPct) / 100);
  const gap = Math.max(0, needed - correct);

  const ranked = [...sections]
    .filter((s) => s.total > 0 && s.recoverPoints > 0)
    .sort((a, b) => b.recoverPoints - a.recoverPoints);

  if (gap <= 5) {
    const pick: string[] = [];
    let pts = 0;
    for (const s of ranked) {
      pick.push(`${s.code} ${s.title}`);
      pts += s.recoverPoints;
      if (pts >= gap) break;
      if (pick.length >= 3) break;
    }
    return {
      kind: "close",
      gap,
      fixSections: pick.length > 0 ? pick : ranked.slice(0, 2).map((s) => `${s.code} ${s.title}`),
    };
  }

  const leaks = [...sections]
    .filter((s) => s.total > 0)
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, 3)
    .map((s) => s.code);

  return { kind: "far", gap, leaks };
}

/**
 * Compare weighted prior prediction (from composition) to actual score.
 *
 * Weights the per-section prior accuracies by the number of Mock questions
 * allocated to that section. Only uses sections with ≥3 prior samples.
 *
 * delta = predicted - actual.
 *   |delta| ≤ 5 → "calibrated"
 *   delta > 5   → "overestimated" (model was too rosy)
 *   delta < -5  → "underestimated" (student overperformed)
 */
function buildCalibration({
  sections,
  actualScore,
}: {
  sections: SectionRow[];
  actualScore: number;
}): Calibration {
  let weightSum = 0;
  let weightedPred = 0;
  for (const s of sections) {
    if (s.priorAccuracyPct == null) continue;
    if (s.total <= 0) continue;
    weightSum += s.total;
    weightedPred += s.priorAccuracyPct * s.total;
  }

  if (weightSum < 10) {
    return {
      predicted: null,
      actual: actualScore,
      delta: null,
      kind: "unknown",
    };
  }

  const predicted = Math.round(weightedPred / weightSum);
  const delta = predicted - actualScore;
  let kind: Calibration["kind"] = "calibrated";
  if (delta > 5) kind = "overestimated";
  else if (delta < -5) kind = "underestimated";

  return { predicted, actual: actualScore, delta, kind };
}
