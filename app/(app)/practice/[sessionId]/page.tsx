import { QuestionRunner } from "@/components/runner/question-runner";
import { loadSessionAndQuestions } from "@/lib/runner/loader";

export default async function PracticeRunner({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, questions } = await loadSessionAndQuestions(sessionId);
  const startedAt = new Date(session.started_at).getTime();

  return (
    <QuestionRunner
      sessionId={sessionId}
      mode="practice"
      questions={questions}
      timed={null}
      startedAt={startedAt}
      behavior="practice"
      resultsPath={`/practice/${sessionId}/results`}
    />
  );
}
