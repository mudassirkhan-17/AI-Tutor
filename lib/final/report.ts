import { SECTIONS } from "@/lib/constants";
import { FINAL_PASS_PCT } from "@/lib/final/pick-questions";

export type AttemptForReport = {
  is_correct: boolean;
  question: {
    section_code: string;
    level: "easy" | "medium" | "hard";
  };
};

export type SectionResult = {
  code: string;
  title: string;
  group: "National" | "State";
  total: number;
  correct: number;
  accuracyPct: number;
};

export type FinalReport = {
  /** National portion */
  nationalCorrect: number;
  nationalTotal: number;
  nationalPct: number;
  nationalPassed: boolean;
  /** State portion */
  stateCorrect: number;
  stateTotal: number;
  statePct: number;
  statePassed: boolean;
  /** Aggregate (informational only — real exam scores per portion) */
  combinedCorrect: number;
  combinedTotal: number;
  combinedPct: number;
  passed: boolean;
  /** Per-section breakdown for both portions */
  sections: SectionResult[];
  /** Section-level "weakest" tags within each portion (lowest accuracy, ≥3 questions). */
  nationalWeakest: string[];
  stateWeakest: string[];
  /** Verdict tier — drives the results page hero copy + CTA. */
  verdict: VerdictTier;
};

export type VerdictTier =
  | { kind: "schedule_real"; portionsAtOrAbove: number } // both ≥85
  | { kind: "ready_margin" } // both 75–84
  | { kind: "ready_narrow" } // both 70–74
  | { kind: "partial_pass_close"; passed: "national" | "state"; otherPct: number }
  | { kind: "partial_pass_far"; passed: "national" | "state"; otherPct: number }
  | { kind: "fail_close"; nationalPct: number; statePct: number }
  | { kind: "fail_far"; nationalPct: number; statePct: number }
  | { kind: "incomplete" };

/* ------------------------------ helpers --------------------------------- */

function pctRound(correct: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

/* ------------------------------ build ----------------------------------- */

export function buildFinalReport({
  attempts,
  passPct = FINAL_PASS_PCT,
}: {
  attempts: AttemptForReport[];
  passPct?: number;
}): FinalReport {
  const sectionAgg = new Map<string, { total: number; correct: number }>();
  let nationalCorrect = 0;
  let nationalTotal = 0;
  let stateCorrect = 0;
  let stateTotal = 0;

  for (const a of attempts) {
    const code = a.question.section_code;
    const slot = sectionAgg.get(code) ?? { total: 0, correct: 0 };
    slot.total += 1;
    if (a.is_correct) slot.correct += 1;
    sectionAgg.set(code, slot);

    if (code.startsWith("A")) {
      nationalTotal += 1;
      if (a.is_correct) nationalCorrect += 1;
    } else if (code.startsWith("B")) {
      stateTotal += 1;
      if (a.is_correct) stateCorrect += 1;
    }
  }

  const nationalPct = pctRound(nationalCorrect, nationalTotal);
  const statePct = pctRound(stateCorrect, stateTotal);
  const nationalPassed = nationalTotal > 0 && nationalPct >= passPct;
  const statePassed = stateTotal > 0 && statePct >= passPct;

  // Real exam: pass iff BOTH portions pass independently.
  const passed =
    (nationalTotal === 0 || nationalPassed) &&
    (stateTotal === 0 || statePassed) &&
    (nationalTotal > 0 || stateTotal > 0);

  const sections: SectionResult[] = SECTIONS.map((s) => {
    const agg = sectionAgg.get(s.code) ?? { total: 0, correct: 0 };
    return {
      code: s.code,
      title: s.title,
      group: s.group as "National" | "State",
      total: agg.total,
      correct: agg.correct,
      accuracyPct: pctRound(agg.correct, agg.total),
    };
  });

  const nationalWeakest = sections
    .filter((s) => s.group === "National" && s.total >= 3)
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, 2)
    .map((s) => `${s.code} ${s.title}`);

  const stateWeakest = sections
    .filter((s) => s.group === "State" && s.total >= 3)
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, 2)
    .map((s) => `${s.code} ${s.title}`);

  const verdict = buildVerdict({
    nationalPct,
    statePct,
    nationalTotal,
    stateTotal,
    passPct,
  });

  return {
    nationalCorrect,
    nationalTotal,
    nationalPct,
    nationalPassed,
    stateCorrect,
    stateTotal,
    statePct,
    statePassed,
    combinedCorrect: nationalCorrect + stateCorrect,
    combinedTotal: nationalTotal + stateTotal,
    combinedPct: pctRound(
      nationalCorrect + stateCorrect,
      nationalTotal + stateTotal,
    ),
    passed,
    sections,
    nationalWeakest,
    stateWeakest,
    verdict,
  };
}

/* ------------------------------ verdict --------------------------------- */

function buildVerdict({
  nationalPct,
  statePct,
  nationalTotal,
  stateTotal,
  passPct,
}: {
  nationalPct: number;
  statePct: number;
  nationalTotal: number;
  stateTotal: number;
  passPct: number;
}): VerdictTier {
  // Partial sessions (one portion only) are valid — verdict considers only
  // the portion that exists.
  if (nationalTotal === 0 && stateTotal === 0) return { kind: "incomplete" };

  // Single-portion mode (partial retake or partial run).
  if (nationalTotal === 0 || stateTotal === 0) {
    const onlyPct = nationalTotal === 0 ? statePct : nationalPct;
    const onlyName: "national" | "state" =
      nationalTotal === 0 ? "state" : "national";
    if (onlyPct >= passPct) {
      // The passed portion verdict — but we still need the user to know
      // they only ran one side. Re-use ready_margin / ready_narrow for clarity.
      if (onlyPct >= 85) return { kind: "schedule_real", portionsAtOrAbove: 1 };
      if (onlyPct >= 75) return { kind: "ready_margin" };
      return { kind: "ready_narrow" };
    }
    if (onlyPct >= passPct - 5) {
      return {
        kind: "partial_pass_close",
        passed: onlyName === "national" ? "state" : "national", // i.e. NOT this one
        otherPct: onlyPct,
      };
    }
    return {
      kind: "partial_pass_far",
      passed: onlyName === "national" ? "state" : "national",
      otherPct: onlyPct,
    };
  }

  const nPassed = nationalPct >= passPct;
  const sPassed = statePct >= passPct;

  // Both pass.
  if (nPassed && sPassed) {
    if (nationalPct >= 85 && statePct >= 85) {
      return { kind: "schedule_real", portionsAtOrAbove: 2 };
    }
    if (nationalPct >= 75 && statePct >= 75) {
      return { kind: "ready_margin" };
    }
    return { kind: "ready_narrow" };
  }

  // Exactly one passed.
  if (nPassed !== sPassed) {
    const passedSide: "national" | "state" = nPassed ? "national" : "state";
    const otherPct = nPassed ? statePct : nationalPct;
    if (otherPct >= passPct - 5) {
      return { kind: "partial_pass_close", passed: passedSide, otherPct };
    }
    return { kind: "partial_pass_far", passed: passedSide, otherPct };
  }

  // Neither passed.
  if (nationalPct < 65 && statePct < 65) {
    return { kind: "fail_far", nationalPct, statePct };
  }
  return { kind: "fail_close", nationalPct, statePct };
}

/* ------------------------------ probability ----------------------------- */

/**
 * Naive predicted real-exam pass probability, given this Final's
 * observed per-portion accuracy. Treats each portion as a binomial sample
 * with proportion p and applies a normal approximation.
 *
 * Returns P(pass national) × P(pass state) when both portions exist.
 */
export function predictedPassProbability(report: FinalReport): number | null {
  const pN = portionPassProb(
    report.nationalPct,
    report.nationalTotal,
    FINAL_PASS_PCT,
  );
  const pS = portionPassProb(
    report.statePct,
    report.stateTotal,
    FINAL_PASS_PCT,
  );

  if (report.nationalTotal === 0 && report.stateTotal === 0) return null;
  if (report.nationalTotal === 0) return pS;
  if (report.stateTotal === 0) return pN;
  if (pN == null || pS == null) return null;
  return Math.round(pN * pS * 100) / 100;
}

function portionPassProb(
  observedPct: number,
  n: number,
  passPct: number,
): number | null {
  if (n === 0) return null;
  const p = observedPct / 100;
  // Standard error of the proportion. Floor for tiny n to avoid overconfidence.
  const se = Math.max(Math.sqrt((p * (1 - p)) / Math.max(n, 1)), 0.02);
  const z = (p - passPct / 100) / se;
  return Math.max(0, Math.min(1, normalCdf(z)));
}

function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26 approximation.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const prob =
    d *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - prob : prob;
}
