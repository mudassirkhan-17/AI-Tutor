import { NextResponse } from "next/server";
import {
  startSession,
  getQuestionsForMode,
  attachQuestionsToSession,
} from "@/lib/runner/session";

export async function POST() {
  const qs = await getQuestionsForMode("practice", { count: 110 });
  if (!qs.length) {
    return NextResponse.json(
      { error: "No questions available. Import your CSV first." },
      { status: 400 },
    );
  }
  const { sessionId } = await startSession({
    mode: "practice",
    config: { question_ids: qs.map((q) => q.id) },
  });
  await attachQuestionsToSession(sessionId, qs.map((q) => q.id));
  return NextResponse.json({ sessionId, runnerPath: `/practice/${sessionId}` });
}
