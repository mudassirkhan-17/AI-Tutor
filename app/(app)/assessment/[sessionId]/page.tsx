import { AssessmentRunner } from "@/components/assessment/assessment-runner";
import { loadSessionAndQuestions } from "@/lib/runner/loader";

export default async function AssessmentRunnerPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, questions } = await loadSessionAndQuestions(sessionId);
  const startedAt = new Date(session.started_at).getTime();

  return (
    <AssessmentRunner
      sessionId={sessionId}
      questions={questions}
      startedAt={startedAt}
      resultsPath={`/assessment/${sessionId}/results`}
    />
  );
}
