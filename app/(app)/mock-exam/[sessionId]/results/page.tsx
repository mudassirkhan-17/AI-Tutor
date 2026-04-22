import { MockReport, type MockAttempt } from "@/components/mock/mock-report";
import { loadSessionAttempts } from "@/lib/runner/loader";
import { buildMockReport } from "@/lib/mock/report";
import { MOCK_PASS_PCT } from "@/lib/mock/pick-questions";
import type { QuestionRow } from "@/lib/supabase/types";

type StoredComposition = Parameters<typeof buildMockReport>[0]["composition"];

export default async function MockExamResults({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, attempts } = await loadSessionAttempts(sessionId);

  const cfg = (session.config ?? {}) as {
    passPct?: number;
    length?: "full" | "smoke";
    composition?: StoredComposition;
  };
  const passPct = cfg.passPct ?? MOCK_PASS_PCT;
  const length = cfg.length ?? "full";
  const composition = cfg.composition ?? null;

  const normalizedAttempts: MockAttempt[] = attempts
    .filter((a: { question: QuestionRow | null }) => !!a.question)
    .map(
      (a: {
        question: QuestionRow;
        user_answer: "A" | "B" | "C" | "D" | null;
        is_correct: boolean;
      }) => ({
        question: a.question,
        user_answer: a.user_answer,
        is_correct: a.is_correct,
      }),
    );

  const total = normalizedAttempts.length;
  const correct = normalizedAttempts.filter((a) => a.is_correct).length;
  const scorePct =
    session.score_pct != null
      ? Math.round(Number(session.score_pct))
      : total > 0
        ? Math.round((correct / total) * 100)
        : 0;

  const report = buildMockReport({
    attempts: normalizedAttempts.map((a) => ({
      is_correct: a.is_correct,
      question: {
        section_code: a.question.section_code,
        level: a.question.level,
      },
    })),
    composition,
    passPct,
  });

  return (
    <MockReport
      sessionId={sessionId}
      score={scorePct}
      total={total}
      correct={correct}
      durationMs={session.duration_ms ?? 0}
      passPct={passPct}
      length={length}
      nationalCorrect={report.nationalCorrect}
      nationalTotal={report.nationalTotal}
      stateCorrect={report.stateCorrect}
      stateTotal={report.stateTotal}
      sections={report.sections}
      difficulty={report.difficulty}
      verdict={report.verdict}
      calibration={report.calibration}
      attempts={normalizedAttempts}
    />
  );
}
