import { ResultsView } from "@/components/runner/results-view";
import { loadSessionAttempts } from "@/lib/runner/loader";

export default async function MistakesResults({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, attempts } = await loadSessionAttempts(sessionId);
  const summary = attempts.map((a) => ({
    question: a.question,
    user_answer: a.user_answer,
    is_correct: a.is_correct,
  }));
  const correct = summary.filter((a) => a.is_correct).length;
  return (
    <ResultsView
      mode="mistakes"
      score={Math.round(Number(session.score_pct ?? 0))}
      total={summary.length}
      correct={correct}
      durationMs={session.duration_ms ?? 0}
      attempts={summary}
      primaryRetryHref="/mistakes"
    />
  );
}
