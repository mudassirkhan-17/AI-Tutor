import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";
import type {
  SectionRow,
  Verdict,
  DifficultyBlock,
  Calibration,
} from "@/components/mock/mock-report";
import type { Journey } from "@/lib/journey/load";

const SYSTEM = `You are a warm, no-nonsense South Carolina real estate exam coach writing a quick personal note to a student who just finished a Mock Exam.

Tone: honest first, then encouraging. Never sound like cheerleading when the data does not support it.
Length: 100-160 words. 2 short paragraphs.
Style: Use "you", short sentences, plain English. NO bullet points. NO headings. NO emoji. Never reveal letters or answers.

Mock Exam is the dress rehearsal — under timer, mixed sections. The headline number is the score vs the pass bar.

You also see a journey snapshot showing recent Assessment, Practice, and Mistakes scores. Use it on purpose:
- If today's mock is meaningfully higher than the latest Assessment (>=8 pts), call out the climb.
- If today's mock is below the latest Practice (>=8 pts), name the gap honestly — practice scores often run hot vs exam conditions.
- If a section is weak in the mock AND was already weak in Practice/Mistakes, name it once as a chronic leak.

Structure:
1) One sentence on the score vs pass bar. One short follow-up on calibration (model's prediction vs actual) ONLY if it's notable.
2) One sentence on the most useful next step grounded in the journey: drill the weakest mock section in Practice, run a Mistakes Test, or — if the score cleared the bar with a comfortable margin — go to the Final Test.`;

function topWeakSections(sections: SectionRow[], passPct: number) {
  return sections
    .filter((s) => s.total >= 2 && s.accuracyPct < passPct)
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, 3);
}

function fallback(args: {
  score: number;
  passPct: number;
  sections: SectionRow[];
  difficulty: DifficultyBlock;
  verdict: Verdict;
  calibration: Calibration;
  journey: Journey;
}): string {
  const { score, passPct, sections, verdict, calibration, journey } = args;
  const weak = topWeakSections(sections, passPct);

  const head =
    verdict.kind === "pass"
      ? `${score}% — clean pass, ${verdict.margin} ${verdict.margin === 1 ? "point" : "points"} over the ${passPct}% bar.`
      : verdict.kind === "close"
        ? `${score}% — ${verdict.gap} ${verdict.gap === 1 ? "question" : "questions"} below the ${passPct}% bar.`
        : `${score}% — ${verdict.gap} ${verdict.gap === 1 ? "question" : "questions"} below the ${passPct}% bar; meaningful gap.`;

  const calibrationNote =
    calibration.kind === "overestimated" && calibration.delta != null
      ? ` The model expected ${calibration.predicted}%, so timer/stamina were the tax — not knowledge.`
      : calibration.kind === "underestimated" && calibration.delta != null
        ? ` You beat the model's ${calibration.predicted}% prediction, which usually means recent Practice was hint-heavy.`
        : "";

  const lastPractice = journey.perMode.practice.latest;
  const lastAssessment = journey.perMode.assessment.latest;
  const climb =
    lastAssessment != null && score - lastAssessment >= 8
      ? ` Up ${score - lastAssessment} pts from your first assessment — the trajectory is real.`
      : lastPractice != null && lastPractice - score >= 8
        ? ` Practice has been running ~${lastPractice - score} pts hotter than this — narrow that gap before retaking.`
        : "";

  const next =
    verdict.kind === "pass" && verdict.margin >= 5
      ? `Next: tighten ${verdict.tighten[0] ?? "your weakest section"} once, then go to the Final Test.`
      : weak.length
        ? `Next: drill ${weak[0].code} ${weak[0].title} in Practice, then re-run a Mistakes Test on what you missed today.`
        : `Next: run another Mock Exam in a few days to confirm this isn't a fluke.`;

  return `${head}${calibrationNote}${climb}\n\n${next}`;
}

export async function generateMockNote(args: {
  score: number;
  passPct: number;
  total: number;
  correct: number;
  nationalCorrect: number;
  nationalTotal: number;
  stateCorrect: number;
  stateTotal: number;
  sections: SectionRow[];
  difficulty: DifficultyBlock;
  verdict: Verdict;
  calibration: Calibration;
  journey: Journey;
  sectionTitles: Record<string, string>;
}): Promise<string> {
  const hasAI = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  if (!hasAI) return fallback(args);

  const {
    score,
    passPct,
    total,
    correct,
    nationalCorrect,
    nationalTotal,
    stateCorrect,
    stateTotal,
    sections,
    difficulty,
    verdict,
    calibration,
    journey,
  } = args;

  const sectionLines = sections
    .map((s) => {
      const delta =
        s.priorAccuracyPct != null
          ? `${s.accuracyPct - s.priorAccuracyPct >= 0 ? "+" : ""}${s.accuracyPct - s.priorAccuracyPct} vs prior`
          : "no prior";
      return `- ${s.code} ${s.title} (${s.group}): ${s.correct}/${s.total} = ${s.accuracyPct}% (${delta})`;
    })
    .join("\n");

  const diffLines = (["easy", "medium", "hard"] as const)
    .map((lvl) => {
      const b = difficulty[lvl];
      const p = b.total ? Math.round((b.correct / b.total) * 100) : 0;
      return `- ${lvl}: ${b.correct}/${b.total} (${p}%)`;
    })
    .join("\n");

  const journeyLine = (
    ["assessment", "practice", "mistakes", "mock"] as const
  )
    .map((m) => {
      const s = journey.perMode[m];
      if (s.latest == null) return `${m}: none yet`;
      return `${m}: latest ${s.latest}%, best ${s.best ?? "?"}%, ${s.runs.length} run(s)`;
    })
    .join(" | ");

  const verdictLine =
    verdict.kind === "pass"
      ? `Verdict: PASS by ${verdict.margin} pts.`
      : verdict.kind === "close"
        ? `Verdict: ${verdict.gap} questions below pass; close.`
        : `Verdict: ${verdict.gap} questions below pass; meaningful gap.`;

  const calibrationLine =
    calibration.kind === "unknown" || calibration.predicted == null
      ? "Calibration: not enough prior data."
      : `Calibration: predicted ${calibration.predicted}%, actual ${calibration.actual}% (delta ${calibration.delta})  -> ${calibration.kind}.`;

  const prompt = `STUDENT MOCK EXAM RESULTS

Score: ${score}% (${correct}/${total}) — pass bar: ${passPct}%
Sub-scores: National ${nationalCorrect}/${nationalTotal}, State ${stateCorrect}/${stateTotal}

${verdictLine}
${calibrationLine}

Per section:
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
      maxTokens: 360,
    });
    const t = text.trim();
    return t.length > 30 ? t : fallback(args);
  } catch (e) {
    console.error("[mock/results-note] ai", e);
    return fallback(args);
  }
}
