import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTIONS, type SectionCode } from "@/lib/constants";

export type AssessmentCoverage = {
  /** Sections the user has already completed at least one finished assessment for. */
  covered: SectionCode[];
  /** Sections still missing an assessment run. */
  missing: SectionCode[];
  /** True only when every section in SECTIONS has been assessed. */
  allCovered: boolean;
  /** First missing section in canonical order (A1 → B6), or null. */
  nextSection: SectionCode | null;
};

const ALL_CODES = SECTIONS.map((s) => s.code) as SectionCode[];

export function emptyCoverage(): AssessmentCoverage {
  return {
    covered: [],
    missing: [...ALL_CODES],
    allCovered: false,
    nextSection: ALL_CODES[0] ?? null,
  };
}

/**
 * A section is "covered" if the user has any attempt in that section that
 * belongs to a finished assessment session. Unfinished/abandoned sessions
 * don't count — the user must actually complete the assessment to unlock
 * downstream modes.
 */
export async function getAssessmentCoverage(
  supabase: SupabaseClient,
  userId: string,
): Promise<AssessmentCoverage> {
  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("mode", "assessment")
    .not("finished_at", "is", null);

  const sessionIds = (sessionRows ?? []).map((r) => (r as { id: string }).id);
  if (!sessionIds.length) return emptyCoverage();

  const { data: attemptRows } = await supabase
    .from("attempts")
    .select("question:questions(section_code)")
    .eq("user_id", userId)
    .in("session_id", sessionIds);

  const coveredSet = new Set<string>();
  for (const row of (attemptRows ?? []) as Array<{
    question: { section_code: string } | { section_code: string }[] | null;
  }>) {
    const q = row.question;
    if (!q) continue;
    const code = Array.isArray(q) ? q[0]?.section_code : q.section_code;
    if (code) coveredSet.add(code);
  }

  const covered = ALL_CODES.filter((c) => coveredSet.has(c));
  const missing = ALL_CODES.filter((c) => !coveredSet.has(c));
  return {
    covered,
    missing,
    allCovered: missing.length === 0,
    nextSection: missing[0] ?? null,
  };
}
