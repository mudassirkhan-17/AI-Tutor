import { NextResponse } from "next/server";
import {
  startSession,
  getQuestionsForMode,
  attachQuestionsToSession,
} from "@/lib/runner/session";
import { MODES } from "@/lib/constants";

export async function POST() {
  const qs = await getQuestionsForMode("mock", { count: MODES.mock.questionCount });
  if (qs.length < 20) {
    return NextResponse.json(
      { error: "Not enough questions in the bank to run a mock exam." },
      { status: 400 },
    );
  }
  const { sessionId } = await startSession({
    mode: "mock",
    config: {
      question_ids: qs.map((q) => q.id),
      durationMin: MODES.mock.durationMin,
      passPct: MODES.mock.passPct,
    },
  });
  await attachQuestionsToSession(sessionId, qs.map((q) => q.id));
  return NextResponse.json({ sessionId, runnerPath: `/mock-exam/${sessionId}` });
}
