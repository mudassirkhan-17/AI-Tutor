import { QuestionRunner } from "@/components/runner/question-runner";
import { loadSessionAndQuestions } from "@/lib/runner/loader";
import { MOCK_DURATION_MIN } from "@/lib/mock/pick-questions";

export default async function MockExamRunner({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, questions } = await loadSessionAndQuestions(sessionId);
  const startedAt = new Date(session.started_at).getTime();

  const cfg = (session.config ?? {}) as {
    durationMin?: number;
  };
  const durationMin = cfg.durationMin ?? MOCK_DURATION_MIN;

  return (
    <QuestionRunner
      sessionId={sessionId}
      mode="mock"
      questions={questions}
      timed={{ durationMin }}
      startedAt={startedAt}
      behavior="exam"
      resultsPath={`/mock-exam/${sessionId}/results`}
    />
  );
}
