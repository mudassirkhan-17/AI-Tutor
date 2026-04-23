import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  session_id: z.string().uuid(),
  question_id: z.string().uuid(),
  mode: z.enum(["assessment", "practice", "mistakes", "mock", "final"]),
  user_answer: z.enum(["A", "B", "C", "D"]).nullable(),
  is_correct: z.boolean(),
  hinted: z.boolean(),
  retried: z.boolean(),
  time_spent_ms: z.number().int().nonnegative(),
  attempt_number: z.number().int().min(1).max(2).default(1),
  result_label: z
    .enum(["mastered", "soft_miss", "hard_miss"])
    .nullable()
    .optional(),
  is_sibling: z.boolean().optional().default(false),
  parent_attempt_id: z.string().uuid().nullable().optional(),
  coached: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload: Record<string, unknown> = { user_id: user.id, ...parsed.data };

  let { data: inserted, error } = await supabase
    .from("attempts")
    .insert(payload)
    .select("id")
    .single();

  // Graceful fallback: if migration 0004 (attempts.coached) hasn't been applied
  // yet, Postgres returns 42703 / "column ... does not exist". Drop the new
  // column and retry so the app keeps working pre-migration.
  if (
    error &&
    (error.code === "42703" || /column .*coached.* does not exist/i.test(error.message))
  ) {
    console.warn(
      "[api/attempts] attempts.coached column missing — apply migration 0004_coached_attempts.sql. Retrying without coached.",
    );
    delete payload.coached;
    const retry = await supabase
      .from("attempts")
      .insert(payload)
      .select("id")
      .single();
    inserted = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("[api/attempts] insert failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: inserted?.id ?? null });
}

const Patch = z.object({
  result_label: z.enum(["mastered", "soft_miss", "hard_miss"]),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = Patch.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { error } = await supabase
    .from("attempts")
    .update({ result_label: parsed.data.result_label })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
