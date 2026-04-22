import { PracticeRunner } from "@/components/runner/practice-runner";
import { loadSessionAndQuestions } from "@/lib/runner/loader";

export default async function PracticeRunnerPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, questions } = await loadSessionAndQuestions(sessionId);
  const startedAt = new Date(session.started_at).getTime();

  return (
    <PracticeRunner
      sessionId={sessionId}
      questions={questions}
      startedAt={startedAt}
      resultsPath={`/practice/${sessionId}/results`}
    />
  );
}
