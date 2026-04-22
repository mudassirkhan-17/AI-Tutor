import { NextResponse } from "next/server";
import {
  startSession,
  getQuestionsForMode,
  attachQuestionsToSession,
} from "@/lib/runner/session";

export async function POST() {
  const qs = await getQuestionsForMode("mistakes", { count: 30 });
  if (!qs.length) {
    return NextResponse.json(
      { error: "Your mistake pool is empty. Finish some practice first." },
      { status: 400 },
    );
  }
  const { sessionId } = await startSession({
    mode: "mistakes",
    config: { question_ids: qs.map((q) => q.id) },
  });
  await attachQuestionsToSession(sessionId, qs.map((q) => q.id));
  return NextResponse.json({ sessionId, runnerPath: `/mistakes/${sessionId}` });
}
