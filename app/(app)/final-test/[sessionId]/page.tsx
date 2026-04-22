import { QuestionRunner } from "@/components/runner/question-runner";
import { loadSessionAndQuestions } from "@/lib/runner/loader";
import { MODES } from "@/lib/constants";

export default async function FinalTestRunner({
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
      mode="final"
      questions={questions}
      timed={{ durationMin: MODES.final.durationMin }}
      startedAt={startedAt}
      behavior="exam"
      resultsPath={`/final-test/${sessionId}/results`}
    />
  );
}
