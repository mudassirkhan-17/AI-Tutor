import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";
import type { MistakesStats } from "./results";
import type { Journey } from "@/lib/journey/load";

const SYSTEM = `You are a warm, no-nonsense South Carolina real estate exam coach writing a quick personal note to a student who just finished a Mistakes Test (a re-run of questions they previously got wrong).

Tone: honest first, then encouraging. Never sound like cheerleading when the data does not support it.
Length: 90-140 words. 2 short paragraphs.
Style: Use "you", short sentences, plain English. NO bullet points. NO headings. NO emoji. Never reveal letters or answers.

Mistakes mode is single-shot, so the headline is "of the things you used to miss, how many did you actually fix?". Frame results as recovered vs still leaking.

You also see a journey snapshot: the student's most recent Assessment, Practice and Mock scores. Use it sparingly:
- If their current Mistakes accuracy is meaningfully higher (>=10 pts) than their last Practice or Assessment score, call out the lift.
- If it's lower, point out that the questions resurfaced were their hardest cluster and the work isn't done.
- If a section keeps showing up weak across modes, name it once.

Structure:
1) One sentence on overall recovery (X of Y fixed = Z% recovered). One short follow-up if hint usage was high (>=30%).
2) One sentence on the weakest section that resurfaced + one sentence on what to do next (re-run a Practice on that section, then another Mistakes Test, or jump to a Mock Exam if recovery is solid).`;

function pickWeakest(stats: MistakesStats, sectionTitles: Record<string, string>) {
  const weak = stats.bySection.filter((s) => s.total >= 2 && s.accuracy < 60);
  if (!weak.length) return null;
  const worst = weak[0]; // already sorted ascending by accuracy
  return {
    code: worst.code,
    title: sectionTitles[worst.code] ?? worst.code,
    accuracy: worst.accuracy,
    total: worst.total,
    recovered: worst.recovered,
  };
}

function fallback(
  stats: MistakesStats,
  journey: Journey,
  sectionTitles: Record<string, string>,
): string {
  const weakest = pickWeakest(stats, sectionTitles);
  const lastPractice = journey.perMode.practice.latest;
  const lastAssessment = journey.perMode.assessment.latest;

  const lift =
    lastPractice != null
      ? stats.accuracy_pct - lastPractice
      : lastAssessment != null
        ? stats.accuracy_pct - lastAssessment
        : null;

  const open = `${stats.recovered} of ${stats.total} fixed — ${stats.accuracy_pct}% recovered.`;
  const hint =
    stats.hint_pct >= 30
      ? ` ${stats.hint_pct}% needed a hint, so a chunk of these aren't fully owned yet.`
      : "";
  const liftSentence =
    lift != null && Math.abs(lift) >= 10
      ? lift > 0
        ? ` That's ${lift} pts above your last ${lastPractice != null ? "Practice" : "Assessment"} — the work is sticking.`
        : ` That's ${Math.abs(lift)} pts under your last ${lastPractice != null ? "Practice" : "Assessment"}, which makes sense — these were your hardest cluster.`
      : "";

  const weakSentence = weakest
    ? `${weakest.title} resurfaced weak (${weakest.recovered}/${weakest.total} = ${weakest.accuracy}%) — that's the section to drill next.`
    : `Nothing screamed weak this round.`;

  const next =
    stats.accuracy_pct >= 75
      ? `Try a Mock Exam to see how this holds up under the timer.`
      : weakest
        ? `Open a Practice run on ${weakest.title}, then come back to Mistakes Test.`
        : `Run another Practice round on your softest section before retesting.`;

  return `${open}${hint}${liftSentence}\n\n${weakSentence} ${next}`;
}

export async function generateMistakesNote(
  stats: MistakesStats,
  journey: Journey,
  sectionTitles: Record<string, string>,
): Promise<string> {
  const hasAI = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  if (!hasAI || stats.total === 0) {
    return fallback(stats, journey, sectionTitles);
  }

  const sectionLines = stats.bySection
    .map(
      (s) =>
        `- ${s.code} ${sectionTitles[s.code] ?? ""}: ${s.recovered}/${s.total} (${s.accuracy}% recovered)`,
    )
    .join("\n");
  const diffLines = stats.byDifficulty
    .map((d) => `- ${d.level}: ${d.recovered}/${d.total} (${d.accuracy}%)`)
    .join("\n");

  const journeyLine = (
    ["assessment", "practice", "mock"] as const
  )
    .map((m) => {
      const s = journey.perMode[m];
      if (s.latest == null) return `${m}: none yet`;
      return `${m}: latest ${s.latest}%, best ${s.best ?? "?"}%, ${s.runs.length} run(s)`;
    })
    .join(" | ");

  const prompt = `STUDENT MISTAKES-TEST RESULTS

Total resurfaced: ${stats.total}
Recovered (correct now): ${stats.recovered}
Still leaking: ${stats.still_leaking}
Recovery accuracy: ${stats.accuracy_pct}%
Hint usage: ${stats.hint_count}/${stats.total} (${stats.hint_pct}%)
Avg time per question: ${Math.round(stats.avg_time_ms / 1000)}s

Per section (recovered/total = accuracy):
${sectionLines || "(no sections)"}

Per difficulty:
${diffLines}

Cross-mode journey snapshot (excluding Final): ${journeyLine}

Write the personal note now.`;

  try {
    const { text } = await generateText({
      model: getModel(),
      system: SYSTEM,
      prompt,
      temperature: 0.35,
      maxTokens: 320,
    });
    const t = text.trim();
    return t.length > 30 ? t : fallback(stats, journey, sectionTitles);
  } catch (e) {
    console.error("[mistakes/results-note] ai", e);
    return fallback(stats, journey, sectionTitles);
  }
}
