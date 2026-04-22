import { QuestionRunner } from "@/components/runner/question-runner";
import { loadSessionAndQuestions } from "@/lib/runner/loader";

export default async function MistakesRunner({
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
      mode="mistakes"
      questions={questions}
      timed={null}
      startedAt={startedAt}
      behavior="reveal"
      resultsPath={`/mistakes/${sessionId}/results`}
    />
  );
}
