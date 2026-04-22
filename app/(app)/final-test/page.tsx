import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModeIntro } from "@/components/runner/mode-intro";
import { MODES } from "@/lib/constants";

export default async function FinalTestIntro() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lastMock } = await supabase
    .from("sessions")
    .select("score_pct")
    .eq("user_id", user.id)
    .eq("mode", "mock")
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const unlocked = Number(lastMock?.score_pct ?? 0) >= 70;
  const m = MODES.final;

  return (
    <ModeIntro
      mode="final"
      title="Your true readiness check."
      blurb={m.blurb}
      questionCount={m.questionCount}
      durationMin={m.durationMin}
      passPct={m.passPct}
      startHref="/final-test"
      startPath="/final-test/start"
      disabled={!unlocked}
      disabledReason={
        unlocked
          ? undefined
          : "Unlocks after a Mock Exam score of 70% or higher."
      }
      bullets={[
        "120 held-out questions not shown in other modes.",
        "Same format and timing as the real exam.",
        "Produces a Readiness Score (0–100) and pass/fail verdict.",
        "Unlocks only after a Mock Exam ≥70%.",
      ]}
    />
  );
}
