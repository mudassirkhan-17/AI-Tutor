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
  question: QuestionRow;
};

type AttemptLite = {
  question_id: string;
  attempt_number: number;
  is_correct: boolean;
  result_label: ResultLabel | null;
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
  lucky: number;
  soft_miss: number;
  hard_miss: number;
  accuracy: number; // mastered / total
};

export type ConceptStat = {
  concept_id: string;
  section_code: string;
  total: number;
  mastered: number;
  lucky: number;
  soft_miss: number;
  hard_miss: number;
  accuracy: number;
};

export type AssessmentSummary = {
  total: number;
  mastered: number;
  lucky: number;
  soft_miss: number;
  hard_miss: number;
  accuracy_pct: number;            // strict: mastered only
  effective_pct: number;           // mastered + lucky + soft (would they get it on exam?)
  sections: SectionStat[];
  weakest_concepts: ConceptStat[]; // top 5 by hard_miss desc, then soft_miss
  strongest_concepts: ConceptStat[]; // top 3 by mastered desc
};

/**
 * Build a summary from raw attempts. We use the FIRST attempt per
 * question to derive the result_label (for quick re-derivation on the
 * results page if needed).
 */
export function buildSummary(attempts: AttemptLite[]): AssessmentSummary {
  // collapse to one row per question (the labelled attempt — usually attempt_number=1
  // when mastered, attempt_number=2 when soft/hard/lucky)
  const byQ = new Map<string, AttemptLite>();
  for (const a of attempts) {
    if (!a.result_label) continue; // keep only labelled rows
    byQ.set(a.question_id, a);
  }
  const rows = Array.from(byQ.values());

  const sectionMap = new Map<string, SectionStat>();
  const conceptMap = new Map<string, ConceptStat>();

  let mastered = 0,
    lucky = 0,
    soft = 0,
    hard = 0;

  for (const r of rows) {
    const sec = r.question.section_code;
    const cid = r.question.concept_id;

    const ss = sectionMap.get(sec) ?? {
      code: sec,
      total: 0,
      mastered: 0,
      lucky: 0,
      soft_miss: 0,
      hard_miss: 0,
      accuracy: 0,
    };
    ss.total += 1;

    if (cid) {
      const cs = conceptMap.get(cid) ?? {
        concept_id: cid,
        section_code: sec,
        total: 0,
        mastered: 0,
        lucky: 0,
        soft_miss: 0,
        hard_miss: 0,
        accuracy: 0,
      };
      cs.total += 1;
      if (r.result_label === "mastered") cs.mastered++;
      if (r.result_label === "lucky") cs.lucky++;
      if (r.result_label === "soft_miss") cs.soft_miss++;
      if (r.result_label === "hard_miss") cs.hard_miss++;
      cs.accuracy = cs.total ? Math.round((cs.mastered / cs.total) * 100) : 0;
      conceptMap.set(cid, cs);
    }

    if (r.result_label === "mastered") {
      ss.mastered++;
      mastered++;
    } else if (r.result_label === "lucky") {
      ss.lucky++;
      lucky++;
    } else if (r.result_label === "soft_miss") {
      ss.soft_miss++;
      soft++;
    } else if (r.result_label === "hard_miss") {
      ss.hard_miss++;
      hard++;
    }
    ss.accuracy = ss.total ? Math.round((ss.mastered / ss.total) * 100) : 0;
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
        b.hard_miss * 2 + b.soft_miss + b.lucky - (a.hard_miss * 2 + a.soft_miss + a.lucky),
    )
    .slice(0, 5);
  const strongest_concepts = [...concepts]
    .filter((c) => c.mastered > 0)
    .sort((a, b) => b.accuracy - a.accuracy || b.mastered - a.mastered)
    .slice(0, 3);

  return {
    total,
    mastered,
    lucky,
    soft_miss: soft,
    hard_miss: hard,
    accuracy_pct: total ? Math.round((mastered / total) * 100) : 0,
    effective_pct: total
      ? Math.round(((mastered + lucky + soft) / total) * 100)
      : 0,
    sections,
    weakest_concepts,
    strongest_concepts,
  };
}
