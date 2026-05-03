import type { QuestionRow, ResultLabel } from "@/lib/supabase/types";

/** A single attempt row joined with its question, used by the report page. */
export type RawAttempt = {
  question_id: string;
  attempt_number: number;
  is_correct: boolean;
  result_label: ResultLabel | null;
  user_answer: "A" | "B" | "C" | "D" | null;
  hinted: boolean;
  retried: boolean;
  time_spent_ms?: number | null;
  question: QuestionRow;
};

type AttemptLite = {
  question_id: string;
  attempt_number: number;
  is_correct: boolean;
  result_label: ResultLabel | null;
  time_spent_ms?: number | null;
  question: {
    id: string;
    section_code: string;
    concept_id: string | null;
    level: "easy" | "medium" | "hard";
  };
};

export type SectionStat = {
  code: string;
  total: number;
  mastered: number;
  soft_miss: number;
  hard_miss: number;
  accuracy: number; // mastered / total
  /** Sum of time_spent_ms across all attempts (incl. 2nd tries) for this section. */
  total_time_ms: number;
  /** total_time_ms / total (rounded). */
  avg_time_ms: number;
};

export type ConceptStat = {
  concept_id: string;
  section_code: string;
  total: number;
  mastered: number;
  soft_miss: number;
  hard_miss: number;
  accuracy: number;
};

/**
 * Predicted real-exam pass probability, derived from a one-sided normal
 * approximation of the binomial. Honest signal: only meaningful when the
 * sample is at least ~10 questions per portion. We expose `signal` so the
 * UI can warn when the estimate is weak.
 */
export type PortionPrediction = {
  total: number;
  mastered: number;
  accuracy_pct: number;
  /** Probability of clearing the SC pass line (70%) on a real-length portion. */
  pass_probability: number;
  /** Bucketed signal strength so the UI can label this as low/medium/strong. */
  signal: "low" | "medium" | "strong";
};

export type AssessmentSummary = {
  total: number;
  mastered: number;
  soft_miss: number;
  hard_miss: number;
  accuracy_pct: number;            // strict: mastered only
  effective_pct: number;           // mastered + soft_miss (recovered after hint/retry)
  sections: SectionStat[];
  weakest_concepts: ConceptStat[]; // top 5 by hard_miss desc, then soft_miss
  strongest_concepts: ConceptStat[]; // top 3 by mastered desc
  /** Sum of time_spent_ms across every recorded attempt. */
  total_time_ms: number;
  /** Average time per question (ms). */
  avg_time_ms: number;
  /** Predicted real-exam pass probability, per portion + combined. */
  predicted: {
    national: PortionPrediction;
    state: PortionPrediction;
    /** P(pass national) * P(pass state). */
    combined_probability: number;
  };
};

/**
 * Cached `sessions.config.summary` may be `{}`, missing nested fields, or
 * pre-migration — `predicted` alone is not enough (empty object is truthy).
 */
export function assessmentSummaryNeedsRefresh(
  summary: AssessmentSummary | null,
): boolean {
  if (!summary || typeof summary.total_time_ms !== "number") return true;
  if (!Array.isArray(summary.sections)) return true;
  const p = summary.predicted;
  if (!p || typeof p !== "object") return true;
  for (const key of ["national", "state"] as const) {
    const portion = p[key];
    if (!portion || typeof portion !== "object") return true;
    if (
      typeof portion.pass_probability !== "number" ||
      Number.isNaN(portion.pass_probability)
    )
      return true;
    if (typeof portion.signal !== "string") return true;
    if (
      typeof portion.accuracy_pct !== "number" ||
      Number.isNaN(portion.accuracy_pct)
    )
      return true;
    if (typeof portion.total !== "number") return true;
  }
  if (
    typeof p.combined_probability !== "number" ||
    Number.isNaN(p.combined_probability)
  )
    return true;
  return false;
}

/** Back-compat: older rows may still hold "lucky"; we count it as mastered. */
function normalizeLabel(
  label: ResultLabel | "lucky" | null,
): ResultLabel | null {
  if (label === "lucky") return "mastered";
  return (label as ResultLabel | null) ?? null;
}

/* ---------------- Pass probability math ---------------- */

const PASS_LINE = 0.7;
/**
 * Real-exam portion sizes (we use these as the n for the predicted
 * probability, regardless of the assessment length the student picked).
 */
const PORTION_REAL_SIZE: Record<"national" | "state", number> = {
  national: 80,
  state: 40,
};

/** Φ(z) — standard normal CDF (Abramowitz & Stegun 7.1.26 approx). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * P(observed accuracy from a length-n exam at this true rate ≥ 70%).
 * Normal approximation to the binomial. Defensive on tiny n.
 */
function portionPassProb(observedPct: number, observedN: number): number {
  if (observedN <= 0) return 0;
  const p = Math.max(0.001, Math.min(0.999, observedPct / 100));
  const n = PORTION_REAL_SIZE.national; // we use the real exam length below
  // Use real exam length so the variance is realistic, not the diagnostic length.
  return 1 - normalCdf((PASS_LINE - p) / Math.sqrt((p * (1 - p)) / n));
}

function signalStrength(n: number): PortionPrediction["signal"] {
  if (n >= 25) return "strong";
  if (n >= 10) return "medium";
  return "low";
}

function buildPortionPrediction(
  sections: SectionStat[],
  prefix: "A" | "B",
): PortionPrediction {
  const portion = sections.filter((s) => s.code.startsWith(prefix));
  const total = portion.reduce((a, b) => a + b.total, 0);
  const mastered = portion.reduce((a, b) => a + b.mastered, 0);
  const accuracy_pct = total ? Math.round((100 * mastered) / total) : 0;
  return {
    total,
    mastered,
    accuracy_pct,
    pass_probability: portionPassProb(accuracy_pct, total),
    signal: signalStrength(total),
  };
}

/**
 * PostgREST may embed `question` as an object or a single-element array.
 * Without normalizing, `question.section_code` is missing → rows dropped → total 0.
 */
function unwrapQuestionEmbed(raw: unknown): AttemptLite["question"] | null {
  if (raw == null) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.section_code !== "string") return null;
  const lv = r.level;
  const level: AttemptLite["question"]["level"] =
    lv === "easy" || lv === "medium" || lv === "hard" ? lv : "medium";
  return {
    id: typeof r.id === "string" ? r.id : "",
    section_code: r.section_code,
    concept_id: typeof r.concept_id === "string" ? r.concept_id : null,
    level,
  };
}

/**
 * Build a summary from raw attempts. We use the FIRST attempt per
 * question to derive the result_label (for quick re-derivation on the
 * results page if needed).
 */
export function buildSummary(attempts: AttemptLite[]): AssessmentSummary {
  const attemptsNorm = attempts.map((a) => {
    const q = unwrapQuestionEmbed((a as { question?: unknown }).question);
    return q ? { ...a, question: q } : a;
  });

  // Total time aggregates across BOTH tries (1 + 2) so per-question time
  // reflects how long the student spent on the question end to end.
  const timeByQ = new Map<string, number>();
  for (const a of attemptsNorm) {
    if (typeof a.time_spent_ms !== "number" || a.time_spent_ms < 0) continue;
    timeByQ.set(
      a.question_id,
      (timeByQ.get(a.question_id) ?? 0) + a.time_spent_ms,
    );
  }

  // Final outcome per question = first attempt that has a result_label
  // (which is set on the LAST attempt for that question — first try if
  // mastered, second try otherwise).
  const byQ = new Map<string, AttemptLite>();
  for (const a of attemptsNorm) {
    const label = normalizeLabel(a.result_label as ResultLabel | "lucky" | null);
    if (!label) continue;
    byQ.set(a.question_id, { ...a, result_label: label });
  }
  const rows = Array.from(byQ.values()).filter(
    (r) => r.question && typeof r.question.section_code === "string",
  );

  const sectionMap = new Map<string, SectionStat>();
  const conceptMap = new Map<string, ConceptStat>();

  let mastered = 0,
    soft = 0,
    hard = 0;

  for (const r of rows) {
    const sec = r.question.section_code;
    const cid = r.question.concept_id;
    const tMs = timeByQ.get(r.question_id) ?? 0;

    const ss = sectionMap.get(sec) ?? {
      code: sec,
      total: 0,
      mastered: 0,
      soft_miss: 0,
      hard_miss: 0,
      accuracy: 0,
      total_time_ms: 0,
      avg_time_ms: 0,
    };
    ss.total += 1;
    ss.total_time_ms += tMs;

    if (cid) {
      const cs = conceptMap.get(cid) ?? {
        concept_id: cid,
        section_code: sec,
        total: 0,
        mastered: 0,
        soft_miss: 0,
        hard_miss: 0,
        accuracy: 0,
      };
      cs.total += 1;
      if (r.result_label === "mastered") cs.mastered++;
      if (r.result_label === "soft_miss") cs.soft_miss++;
      if (r.result_label === "hard_miss") cs.hard_miss++;
      cs.accuracy = cs.total ? Math.round((cs.mastered / cs.total) * 100) : 0;
      conceptMap.set(cid, cs);
    }

    if (r.result_label === "mastered") {
      ss.mastered++;
      mastered++;
    } else if (r.result_label === "soft_miss") {
      ss.soft_miss++;
      soft++;
    } else if (r.result_label === "hard_miss") {
      ss.hard_miss++;
      hard++;
    }
    ss.accuracy = ss.total ? Math.round((ss.mastered / ss.total) * 100) : 0;
    ss.avg_time_ms = ss.total ? Math.round(ss.total_time_ms / ss.total) : 0;
    sectionMap.set(sec, ss);
  }

  const total = rows.length;
  const sections = Array.from(sectionMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code),
  );

  // Exclude `{section}.general` buckets from concept-level recommendations —
  // these are weak/cross-topic labels (conf ~0.45 at labelling time) and not
  // useful for targeted remediation. They still count toward section stats.
  const concepts = Array.from(conceptMap.values()).filter(
    (c) => !c.concept_id.endsWith(".general"),
  );
  const weakest_concepts = [...concepts]
    .filter((c) => c.hard_miss + c.soft_miss > 0)
    .sort(
      (a, b) =>
        b.hard_miss * 2 + b.soft_miss - (a.hard_miss * 2 + a.soft_miss),
    )
    .slice(0, 5);
  const strongest_concepts = [...concepts]
    .filter((c) => c.mastered > 0)
    .sort((a, b) => b.accuracy - a.accuracy || b.mastered - a.mastered)
    .slice(0, 3);

  const total_time_ms = sections.reduce((a, s) => a + s.total_time_ms, 0);

  const national = buildPortionPrediction(sections, "A");
  const state = buildPortionPrediction(sections, "B");

  return {
    total,
    mastered,
    soft_miss: soft,
    hard_miss: hard,
    accuracy_pct: total ? Math.round((mastered / total) * 100) : 0,
    effective_pct: total
      ? Math.round(((mastered + soft) / total) * 100)
      : 0,
    sections,
    weakest_concepts,
    strongest_concepts,
    total_time_ms,
    avg_time_ms: total ? Math.round(total_time_ms / total) : 0,
    predicted: {
      national,
      state,
      combined_probability: national.pass_probability * state.pass_probability,
    },
  };
}
