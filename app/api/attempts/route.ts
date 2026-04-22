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
    .enum(["mastered", "lucky", "soft_miss", "hard_miss"])
    .nullable()
    .optional(),
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

  const { error } = await supabase.from("attempts").insert({
    user_id: user.id,
    ...parsed.data,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
