import { FinalExamRunner } from "@/components/final/final-exam-runner";
import { loadSessionAndQuestions } from "@/lib/runner/loader";
import type { QuestionRow } from "@/lib/supabase/types";

export default async function FinalTestRunner({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, questions } = await loadSessionAndQuestions(sessionId);

  const cfg = (session.config ?? {}) as {
    national_question_ids?: string[];
    state_question_ids?: string[];
    portion?: "both" | "national" | "state";
  };

  const byId = new Map<string, QuestionRow>(questions.map((q) => [q.id, q]));
  const nationalQuestions: QuestionRow[] = (cfg.national_question_ids ?? [])
    .map((id) => byId.get(id))
    .filter(Boolean) as QuestionRow[];
  const stateQuestions: QuestionRow[] = (cfg.state_question_ids ?? [])
    .map((id) => byId.get(id))
    .filter(Boolean) as QuestionRow[];

  const initialPhase: "national" | "state" =
    cfg.portion === "state"
      ? "state"
      : cfg.portion === "national"
        ? "national"
        : nationalQuestions.length > 0
          ? "national"
          : "state";

  const startedAtMs = new Date(session.started_at).getTime();

  return (
    <FinalExamRunner
      sessionId={sessionId}
      nationalQuestions={nationalQuestions}
      stateQuestions={stateQuestions}
      nationalStartedAtMs={startedAtMs}
      initialPhase={initialPhase}
      resultsPath={`/final-test/${sessionId}/results`}
    />
  );
}
