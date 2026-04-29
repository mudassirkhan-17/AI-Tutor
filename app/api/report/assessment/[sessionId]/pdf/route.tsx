export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { buildSummary } from "@/lib/assessment/summary";
import type { AssessmentSummary } from "@/lib/assessment/summary";
import { SECTIONS } from "@/lib/constants";
import { AssessmentPdf } from "@/lib/pdf/assessment-pdf";
import type { DocumentProps } from "@react-pdf/renderer";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  /* Load session */
  const { data: session } = await supabase
    .from("sessions")
    .select("id, duration_ms, config, started_at")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const config = (session.config ?? {}) as Record<string, unknown>;
  let summary: AssessmentSummary | null =
    (config.summary as AssessmentSummary | undefined) ?? null;
  const tutorLetter: string | null =
    (config.tutor_letter as string | undefined) ?? null;

  /* Rebuild summary if missing or stale */
  if (
    !summary ||
    typeof summary.total_time_ms !== "number" ||
    !summary.predicted
  ) {
    const { data: attempts } = await supabase
      .from("attempts")
      .select(
        "question_id, attempt_number, is_correct, result_label, time_spent_ms, question:questions(id, section_code, concept_id, level)",
      )
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    summary = buildSummary(
      ((attempts ?? []) as unknown) as Parameters<typeof buildSummary>[0],
    );
  }

  /* Concept titles */
  const conceptIds = [
    ...summary.weakest_concepts.map((c) => c.concept_id),
    ...summary.strongest_concepts.map((c) => c.concept_id),
  ];
  const conceptTitles: Record<string, string> = {};
  if (conceptIds.length) {
    const { data: rows } = await supabase
      .from("concepts")
      .select("id, title")
      .in("id", conceptIds);
    for (const r of rows ?? []) conceptTitles[r.id] = r.title;
  }

  const sectionTitles = Object.fromEntries(
    SECTIONS.map((s) => [s.code, s.title]),
  );

  const generatedAt = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  /* Render PDF — cast needed because React.createElement infers props type,
     not the narrower DocumentProps that renderToBuffer expects */
  const element = React.createElement(AssessmentPdf, {
    summary,
    sessionId,
    durationMs: session.duration_ms ?? 0,
    sectionTitles,
    conceptTitles,
    tutorLetter,
    generatedAt,
  }) as unknown as React.ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="assessment-report-${sessionId.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-cache",
    },
  });
  } catch (err) {
    console.error("[PDF] render failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: String(err) },
      { status: 500 },
    );
  }
}
