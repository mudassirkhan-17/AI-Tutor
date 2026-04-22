import { PracticeRunner } from "@/components/runner/practice-runner";
import { loadSessionAndQuestions } from "@/lib/runner/loader";
import type { QuestionOrigin } from "@/lib/mistakes/pick-questions";

export default async function MistakesRunner({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, questions } = await loadSessionAndQuestions(sessionId);
  const startedAt = new Date(session.started_at).getTime();

  const origins =
    ((session.config as Record<string, unknown> | null)?.question_origins as
      | Record<string, QuestionOrigin>
      | undefined) ?? {};

  return (
    <PracticeRunner
      sessionId={sessionId}
      questions={questions}
      startedAt={startedAt}
      resultsPath={`/mistakes/${sessionId}/results`}
      mode="mistakes"
      siblingDifficulty="harder"
      questionOrigins={origins}
    />
  );
}
