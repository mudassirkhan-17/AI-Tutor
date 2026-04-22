import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssessmentReport } from "@/components/assessment/assessment-report";
import { buildSummary } from "@/lib/assessment/summary";
import type { AssessmentSummary, RawAttempt } from "@/lib/assessment/summary";
import { SECTIONS } from "@/lib/constants";
import { getAssessmentCoverage } from "@/lib/assessment/coverage";

export default async function AssessmentResults({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select("id, started_at, finished_at, score_pct, duration_ms, config")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();
  if (!session) redirect("/dashboard");

  const config = (session.config ?? {}) as Record<string, unknown>;
  let summary: AssessmentSummary | null =
    (config.summary as AssessmentSummary | undefined) ?? null;
  const tutorLetter: string | null =
    (config.tutor_letter as string | undefined) ?? null;

  // Fallback: rebuild summary on the fly if it wasn't stored (older session
  // or finish call partially failed).
  if (!summary) {
    const { data: attempts } = await supabase
      .from("attempts")
      .select(
        "question_id, attempt_number, is_correct, result_label, question:questions(id, section_code, concept_id, level)",
      )
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    summary = buildSummary(
      ((attempts ?? []) as unknown) as Parameters<typeof buildSummary>[0],
    );
  }

  // Pretty concept titles
  const conceptIds = [
    ...summary.weakest_concepts.map((c) => c.concept_id),
    ...summary.strongest_concepts.map((c) => c.concept_id),
  ];
  const conceptTitles: Record<string, string> = {};
  if (conceptIds.length) {
    const { data: rows } = await supabase
      .from("concepts")
      .select("id, title")
      .in("id", conceptIds);
    for (const r of rows ?? []) conceptTitles[r.id] = r.title;
  }

  // Build review list (per-question) for "Review every question" section
  const { data: rawAttempts } = await supabase
    .from("attempts")
    .select(
      "question_id, attempt_number, is_correct, result_label, user_answer, hinted, retried, question:questions(*)",
    )
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const coverage = await getAssessmentCoverage(supabase, user.id);

  return (
    <AssessmentReport
      sessionId={sessionId}
      durationMs={session.duration_ms ?? 0}
      summary={summary}
      tutorLetter={tutorLetter}
      conceptTitles={conceptTitles}
      sectionTitles={Object.fromEntries(
        SECTIONS.map((s) => [s.code, s.title]),
      )}
      attempts={(rawAttempts ?? []) as unknown as RawAttempt[]}
      lengthLabel={
        (config.length as "quick" | "deep" | "smoke" | undefined) ?? null
      }
      coverage={coverage}
    />
  );
}
