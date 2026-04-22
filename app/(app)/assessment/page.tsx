import { AssessmentPicker } from "@/components/assessment/assessment-picker";
import { createClient } from "@/lib/supabase/server";
import { SECTIONS } from "@/lib/constants";

export default async function AssessmentIntro() {
  const supabase = await createClient();

  // Per-section counts via HEAD count queries so we don't hit the
  // default 1000-row select cap when the bank grows past ~1k rows.
  const results = await Promise.all(
    SECTIONS.map((s) =>
      supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("section_code", s.code)
        .eq("pool", "standard")
        .then(({ count }) => [s.code, count ?? 0] as const),
    ),
  );
  const counts: Record<string, number> = Object.fromEntries(results);

  const sections = SECTIONS.map((s) => ({ ...s, count: counts[s.code] ?? 0 }));

  return <AssessmentPicker sections={sections} />;
}
