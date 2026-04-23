import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssessmentSummary } from "@/lib/assessment/summary";

/**
 * Per-section accuracy snapshot the student had BEFORE this practice run.
 * We resolve in this order:
 *   1) The most recent finished `assessment` session — use cached
 *      `config.summary.sections` (mastered / total → accuracy_pct).
 *   2) Lifetime accuracy from `v_user_section_mastery` minus this run's
 *      contribution (best-effort approximation if no assessment exists).
 *   3) null per section.
 */
export type BaselineSection = {
  code: string;
  /** 0-100, or null when we have no prior data for this section. */
  accuracy: number | null;
  /** How many questions back the baseline was sampled from. */
  total: number;
};

export type PracticeBaseline = {
  source: "assessment" | "lifetime" | "none";
  /** ISO of the source session start, when source === 'assessment'. */
  capturedAt: string | null;
  bySection: Record<string, BaselineSection>;
};

export async function loadPracticeBaseline(
  supabase: SupabaseClient,
  userId: string,
  thisSessionId: string,
): Promise<PracticeBaseline> {
  // 1) Latest finished assessment, excluding this practice session.
  const { data: assessmentSessions } = await supabase
    .from("sessions")
    .select("id, started_at, config")
    .eq("user_id", userId)
    .eq("mode", "assessment")
    .eq("status", "finished")
    .neq("id", thisSessionId)
    .order("started_at", { ascending: false })
    .limit(1);

  const lastAssessment = (assessmentSessions ?? [])[0] as
    | { id: string; started_at: string; config: Record<string, unknown> | null }
    | undefined;

  if (lastAssessment) {
    const cfg = (lastAssessment.config ?? {}) as { summary?: AssessmentSummary };
    const sections = cfg.summary?.sections;
    if (sections && sections.length) {
      const bySection: Record<string, BaselineSection> = {};
      for (const s of sections) {
        const acc = s.total
          ? Math.round((100 * s.mastered) / s.total)
          : null;
        bySection[s.code] = {
          code: s.code,
          accuracy: acc,
          total: s.total,
        };
      }
      return {
        source: "assessment",
        capturedAt: lastAssessment.started_at,
        bySection,
      };
    }
  }

  // 2) Lifetime mastery view fallback.
  const { data: rows } = await supabase
    .from("v_user_section_mastery")
    .select("section_code, total, correct, accuracy")
    .eq("user_id", userId);

  if (rows && rows.length) {
    const bySection: Record<string, BaselineSection> = {};
    for (const r of rows as Array<{
      section_code: string;
      total: number;
      correct: number;
      accuracy: number | null;
    }>) {
      bySection[r.section_code] = {
        code: r.section_code,
        accuracy: r.accuracy != null ? Math.round(r.accuracy) : null,
        total: r.total,
      };
    }
    return { source: "lifetime", capturedAt: null, bySection };
  }

  return { source: "none", capturedAt: null, bySection: {} };
}
