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

  const { data: inserted, error } = await supabase
    .from("attempts")
    .insert({
      user_id: user.id,
      ...parsed.data,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
