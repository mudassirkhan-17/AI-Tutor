import { NextResponse } from "next/server";
import { z } from "zod";
import { startSession } from "@/lib/runner/session";
import { createClient } from "@/lib/supabase/server";
import { getAssessmentCoverage } from "@/lib/assessment/coverage";
import {
  pickPracticeQuestions,
  PRACTICE_TOTAL,
  PRACTICE_SMOKE_TOTAL,
} from "@/lib/practice/pick-questions";

const Body = z
  .object({
    length: z.enum(["full", "smoke"]).optional().default("full"),
  })
  .optional()
  .default({ length: "full" });

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const coverage = await getAssessmentCoverage(supabase, user.id);
  if (!coverage.allCovered) {
    return NextResponse.json(
      {
        error: `Finish the assessment first — ${coverage.missing.length} section${
          coverage.missing.length === 1 ? "" : "s"
        } still need a baseline.`,
        missing: coverage.missing,
        nextSection: coverage.nextSection,
      },
      { status: 403 },
    );
  }

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  const length = parsed.success ? parsed.data.length : "full";
  const total = length === "smoke" ? PRACTICE_SMOKE_TOTAL : PRACTICE_TOTAL;

  const qs = await pickPracticeQuestions(supabase, user.id, total);
  if (!qs.length) {
    return NextResponse.json(
      { error: "No questions available. Import your CSV first." },
      { status: 400 },
    );
  }

  const { sessionId } = await startSession({
    mode: "practice",
    config: {
      question_ids: qs.map((q) => q.id),
      length,
      target_total: total,
    },
  });

  return NextResponse.json({
    sessionId,
    runnerPath: `/practice/${sessionId}`,
    length,
    total,
  });
}
