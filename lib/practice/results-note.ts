import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";
import type { PracticeStats } from "./results";
import type { PracticeBaseline } from "./baseline";

const SYSTEM = `You are a warm, no-nonsense South Carolina real estate exam coach writing a quick personal note to a student who just finished a Practice run.

Tone: honest first, then encouraging. Never sound like cheerleading when the data does not support it.
Length: 90-140 words. 2 short paragraphs.
Style: Use "you", short sentences, plain English. NO bullet points. NO headings. NO emoji.

Two scores you must respect:
- "First-try mastery" = correct on the first attempt with no coach, no hint, no sibling. This is the strict signal.
- "Reach" = mastery + recovered after the AI sibling follow-up. Softer signal.

You also see a "vs Assessment" delta per section (positive = improved, negative = regressed). Only mention it when it is meaningful (>=5 pts for a section with >=5 questions). If multiple sections moved, name the biggest move (positive or negative). Do not invent numbers.

Calibration:
- If first-try % is high (~70%+), you may open positively.
- If first-try is below 50%, lead with the truth, then point at recovery / coached signals if they were better.
- If "coached %" is high (>=40%), gently note that coached mastery still needs a solo run to count as exam-ready.
- Never reveal answers or letters. No question IDs. No raw codes like "A2" — translate via the provided section title map.

Structure:
1) One sentence on first-try result, optionally one short phrase on reach if it adds something.
2) One sentence on the biggest delta vs the last assessment (if any), then one sentence on the most useful next step (Mistakes Test, drilling a specific section, or another Practice run).`;

function pickBiggestDelta(
  stats: PracticeStats,
  baseline: PracticeBaseline,
  sectionTitles: Record<string, string>,
): {
  code: string;
  title: string;
  practice: number;
  before: number;
  delta: number;
} | null {
  let best: {
    code: string;
    title: string;
    practice: number;
    before: number;
    delta: number;
    score: number;
  } | null = null;
  for (const s of stats.bySection) {
    if (s.total < 3) continue;
    const b = baseline.bySection[s.code];
    if (!b || b.accuracy == null) continue;
    const delta = s.accuracy - b.accuracy;
    if (Math.abs(delta) < 5) continue;
    const score = Math.abs(delta) * Math.sqrt(s.total);
    if (!best || score > best.score) {
      best = {
        code: s.code,
        title: sectionTitles[s.code] ?? s.code,
        practice: s.accuracy,
        before: b.accuracy,
        delta,
        score,
      };
    }
  }
  return best
    ? {
        code: best.code,
        title: best.title,
        practice: best.practice,
        before: best.before,
        delta: best.delta,
      }
    : null;
}

function fallback(
  stats: PracticeStats,
  baseline: PracticeBaseline,
  sectionTitles: Record<string, string>,
): string {
  const big = pickBiggestDelta(stats, baseline, sectionTitles);
  const open =
    stats.first_try_pct >= 70
      ? `Solid run: ${stats.first_try_pct}% first-try across ${stats.total} questions${
          stats.reach_pct > stats.first_try_pct
            ? `, ${stats.reach_pct}% with the AI follow-up factored in`
            : ""
        }.`
      : stats.first_try_pct >= 50
        ? `Mixed run: ${stats.first_try_pct}% first-try across ${stats.total} questions${
            stats.reach_pct > stats.first_try_pct
              ? ` (${stats.reach_pct}% reach)`
              : ""
          } — within range, not exam-ready yet.`
        : `Honest read: ${stats.first_try_pct}% first-try across ${stats.total} questions${
            stats.reach_pct > stats.first_try_pct
              ? `; you reached ${stats.reach_pct}% after recovery`
              : ""
          }, so the material is gettable but cold recall is not there yet.`;

  const coachedNote =
    stats.coached_pct >= 40
      ? ` ${stats.coached_pct}% of these were coached — those still need a solo pass to count as locked in.`
      : "";

  const deltaSentence = big
    ? big.delta > 0
      ? `Biggest gain since your last assessment: ${big.title} jumped ${big.delta} pts (${big.before}% → ${big.practice}%).`
      : `Watch ${big.title} — it slipped ${Math.abs(big.delta)} pts vs your last assessment (${big.before}% → ${big.practice}%).`
    : baseline.source === "assessment"
      ? `No big swings vs your last assessment — keep stacking reps.`
      : `Take an Assessment when you can so we can show real movement next time.`;

  const next =
    stats.hard >= 3
      ? `Next step: open Mistakes Test on the ${stats.hard} you missed twice — that's the fastest minute-for-minute.`
      : stats.first_try_pct < 60
        ? `Next step: another Practice run focused on your weakest section.`
        : `Next step: try a Mock Exam to see how this holds up under timer pressure.`;

  return `${open}${coachedNote}\n\n${deltaSentence} ${next}`;
}

export async function generatePracticeNote(
  stats: PracticeStats,
  baseline: PracticeBaseline,
  sectionTitles: Record<string, string>,
): Promise<string> {
  const hasAI = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  if (!hasAI) return fallback(stats, baseline, sectionTitles);

  const sectionLines = stats.bySection
    .map((s) => {
      const b = baseline.bySection[s.code];
      const before = b?.accuracy != null ? `${b.accuracy}%` : "no prior";
      const delta = b?.accuracy != null ? `${s.accuracy - b.accuracy >= 0 ? "+" : ""}${s.accuracy - b.accuracy}` : "n/a";
      return `- ${s.code} ${sectionTitles[s.code] ?? ""}: ${s.correct}/${s.total} (${s.accuracy}% practice; baseline ${before}; delta ${delta})`;
    })
    .join("\n");
  const diffLines = stats.byDifficulty
    .map((d) => `- ${d.level}: ${d.correct}/${d.total} (${d.accuracy}%)`)
    .join("\n");

  const baselineSummary =
    baseline.source === "assessment"
      ? `Baseline source: most recent finished assessment (started ${baseline.capturedAt ?? "?"}).`
      : baseline.source === "lifetime"
        ? `Baseline source: lifetime per-section accuracy across all attempts (no prior assessment found).`
        : `Baseline source: none — no prior data to compare against.`;

  const prompt = `STUDENT PRACTICE RESULTS

Total: ${stats.total} questions
Mastered (first try): ${stats.mastered} (${stats.strict_pct}%)
First-try correct (any path): ${stats.first_try_pct}%
Recovered after AI sibling: ${stats.soft}
Hard miss (missed both): ${stats.hard}
Reach (mastered + recovered): ${stats.reach} of ${stats.total} (${stats.reach_pct}%)
Coached at any point: ${stats.coached_count}/${stats.total} (${stats.coached_pct}%)
Used a hint: ${stats.hint_count}/${stats.total} (${stats.hint_pct}%)
Sibling recovery rate: ${stats.sibling_recovered}/${stats.sibling_attempts} (${stats.recovery_pct}%)

Per section (first-try basis):
${sectionLines || "(no sections)"}

Per difficulty (first-try basis):
${diffLines}

${baselineSummary}

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
    return t.length > 30 ? t : fallback(stats, baseline, sectionTitles);
  } catch (e) {
    console.error("[practice/results-note] ai", e);
    return fallback(stats, baseline, sectionTitles);
  }
}
