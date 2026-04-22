import { NextResponse } from "next/server";
import {
  startSession,
  getQuestionsForMode,
  attachQuestionsToSession,
} from "@/lib/runner/session";
import { createClient } from "@/lib/supabase/server";
import { MODES } from "@/lib/constants";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: lastMock } = await supabase
    .from("sessions")
    .select("score_pct")
    .eq("user_id", user.id)
    .eq("mode", "mock")
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (Number(lastMock?.score_pct ?? 0) < 70) {
    return NextResponse.json(
      { error: "Final Test unlocks after a Mock Exam score of 70% or higher." },
      { status: 403 },
    );
  }

  let qs = await getQuestionsForMode("final", {
    count: MODES.final.questionCount,
    pool: "final_holdout",
  });
  // Fallback: if no held-out pool exists yet, use the standard pool so the
  // Final Test is still runnable.
  if (qs.length < 20) {
    qs = await getQuestionsForMode("final", {
      count: MODES.final.questionCount,
      pool: "standard",
    });
  }
  if (qs.length < 20) {
    return NextResponse.json(
      { error: "Not enough questions in the bank to run the Final Test." },
      { status: 400 },
    );
  }

  const { sessionId } = await startSession({
    mode: "final",
    config: {
      question_ids: qs.map((q) => q.id),
      durationMin: MODES.final.durationMin,
      passPct: MODES.final.passPct,
    },
  });
  await attachQuestionsToSession(sessionId, qs.map((q) => q.id));
  return NextResponse.json({ sessionId, runnerPath: `/final-test/${sessionId}` });
}
