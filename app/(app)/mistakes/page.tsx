import { redirect } from "next/navigation";
import { ModeIntro } from "@/components/runner/mode-intro";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default async function MistakesIntro() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pool } = await supabase
    .from("v_user_mistakes")
    .select("question_id", { count: "exact" })
    .eq("user_id", user.id)
    .eq("resolved", false);

  const count = pool?.length ?? 0;

  if (count === 0) {
    return (
      <Card>
        <CardContent className="pt-10 pb-10 text-center">
          <Sparkles className="h-6 w-6 text-primary mx-auto" />
          <h2 className="font-serif text-3xl font-semibold mt-3">
            No mistakes to review — yet.
          </h2>
          <p className="mt-2 text-ink-muted">
            Finish a Practice or Assessment session. Any questions you miss
            will show up here to re-drill.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild>
              <Link href="/practice">Go to Practice</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/assessment">Take Assessment</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <ModeIntro
      mode="mistakes"
      title="Re-drill the ones that got away."
      blurb={`You have ${count} unresolved mistake${count === 1 ? "" : "s"} in your pool.`}
      questionCount={Math.min(30, count)}
      startHref="/mistakes"
      startPath="/mistakes/start"
      bullets={[
        "Questions come from your personal mistake pool.",
        "One shot per question — no retry-with-hint.",
        "Get a question right twice to resolve it and remove it from the pool.",
        "We surface your weakest sections first.",
      ]}
    />
  );
}
