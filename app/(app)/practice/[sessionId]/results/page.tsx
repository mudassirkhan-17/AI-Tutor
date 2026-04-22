import { ResultsView } from "@/components/runner/results-view";
import { loadSessionAttempts } from "@/lib/runner/loader";

export default async function PracticeResults({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, attempts } = await loadSessionAttempts(sessionId);
  // For practice with retries, dedupe by question and use the last attempt's outcome
  const dedup = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) dedup.set(a.question_id, a);
  const summary = Array.from(dedup.values()).map((a) => ({
    question: a.question,
    user_answer: a.user_answer,
    is_correct: a.is_correct,
  }));
  const correct = summary.filter((a) => a.is_correct).length;
  return (
    <ResultsView
      mode="practice"
      score={Math.round(Number(session.score_pct ?? 0))}
      total={summary.length}
      correct={correct}
      durationMs={session.duration_ms ?? 0}
      attempts={summary}
      primaryRetryHref="/practice"
    />
  );
}
