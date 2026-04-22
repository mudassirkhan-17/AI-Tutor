import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";
import type { AssessmentSummary } from "./summary";

const SYSTEM = `You are a warm, no-nonsense South Carolina real estate exam coach writing a personal note to a student who just finished a diagnostic assessment.

Tone: honest first, then encouraging. Never sound like cheerleading when the data does not support it.
Length: 110-160 words. 3 short paragraphs OR 4 punchy ones.
Style: Use "you", short sentences, plain English. NO bullet points. NO headings.

The app shows two different scores — you must respect both:
- "Strict" / first-try mastery: questions answered correctly on the FIRST try with NO hint (this is the big headline %).
- "Effective": includes items they eventually got right after a hint or on the second try (softer bar).

Calibration rules (mandatory):
- If STRICT first-try mastery is 0% OR mastered count is 0, sentence 1 must NOT open with praise ("great job", "solid start", "well done"). Lead with the strict truth in plain words, then (if effective % is higher) name that as reachable progress in sentence 2.
- If strict % is high (about 60%+), you may open positively and briefly.
- If the run had very few questions (e.g. 2–4), say explicitly that this is a tiny sample and trends matter more on a longer diagnostic.

Structure:
1) One sentence on strict first-try result; optionally one short phrase on effective % if it tells a different story.
2) Name 1-2 areas that looked strongest (if any) and 1-2 to drill (from the concept lists). If nothing was mastered on first try, skip fake praise for "strengths" — say what still looked relatively better or what to drill first.
3) One sentence next step (Practice mode on weak topics, or Mistakes Test).

NEVER mention question IDs, codes like "A2.taxation_and_assessments", or raw labels like "soft_miss". Translate codes to readable names.`;

function humanizeConcept(id: string) {
  const tail = id.split(".").slice(1).join(" ") || id;
  return tail
    .replace(/_/g, " ")
    .replace(/\boldcar\b/gi, "OLDCAR")
    .replace(/\bsc\b/gi, "SC")
    .replace(/\bpmi\b/gi, "PMI")
    .replace(/\brespa\b/gi, "RESPA")
    .replace(/\btila\b/gi, "TILA")
    .replace(/\bltv\b/gi, "LTV")
    .replace(/\bfha\b/gi, "FHA")
    .replace(/\bva\b/gi, "VA")
    .trim();
}

const FALLBACK = (s: AssessmentSummary) => {
  const weakNames = s.weakest_concepts
    .slice(0, 2)
    .map((c) => humanizeConcept(c.concept_id))
    .join(" and ");
  const strongNames = s.strongest_concepts
    .slice(0, 2)
    .map((c) => humanizeConcept(c.concept_id))
    .join(" and ");
  const tiny = s.total <= 4;
  const tinyNote = tiny
    ? ` This was only ${s.total} question${s.total === 1 ? "" : "s"} — treat it as a smoke check, not a full picture.`
    : "";

  let open: string;
  if (s.mastered === 0 && s.total > 0) {
    open =
      s.effective_pct >= 50
        ? `On first try with no hint, none of the ${s.total} items were clean yet (0% strict).${tinyNote} After a hint or second pass you still reached about ${s.effective_pct}% effective — that means the material is within reach, not that exam-day cold mastery is there yet.`
        : `First-try mastery is still building: 0 of ${s.total} clean on the first shot (${s.accuracy_pct}% strict).${tinyNote}`;
  } else if (s.accuracy_pct >= 75) {
    open = `Strong showing: ${s.mastered} of ${s.total} locked in on the first try (${s.accuracy_pct}% strict).${tinyNote}`;
  } else if (s.accuracy_pct >= 55) {
    open = `Solid foundation: ${s.mastered} of ${s.total} mastered on first try (${s.accuracy_pct}% strict), with more room to sharpen.${tinyNote}`;
  } else {
    open = `We have clear gaps to close: ${s.mastered} of ${s.total} mastered on first try (${s.accuracy_pct}% strict).${tinyNote}`;
  }

  const strengthLine =
    s.mastered === 0
      ? strongNames
        ? `Relative bright spots (still not first-try clean): ${strongNames}.`
        : `We have not pinned a first-try strength yet — that is normal on a short or hard set.`
      : `You're already comfortable with ${strongNames || "several core ideas"}.`;

  const weakLine = weakNames
    ? `Where to drill first: ${weakNames}.`
    : `Focus on the sections where you needed a hint or missed twice.`;

  return `${open}

${strengthLine} ${weakLine} Small gaps close fast with focused reps.

Next step: open Practice mode (or Mistakes) and let the app weight weak topics so every minute moves the needle.`;
};

export async function generateTutorLetter(
  summary: AssessmentSummary,
): Promise<string> {
  const hasAI =
    !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  if (!hasAI) return FALLBACK(summary);

  const weak = summary.weakest_concepts
    .map(
      (c) =>
        `- ${humanizeConcept(c.concept_id)} (${c.hard_miss} hard miss, ${c.soft_miss} soft, ${c.lucky} lucky out of ${c.total})`,
    )
    .join("\n");
  const strong = summary.strongest_concepts
    .map(
      (c) => `- ${humanizeConcept(c.concept_id)} (${c.mastered}/${c.total} clean)`,
    )
    .join("\n");
  const sectionLines = summary.sections
    .map(
      (s) =>
        `- ${s.code}: ${s.mastered}/${s.total} mastered (${s.hard_miss} hard, ${s.soft_miss} soft)`,
    )
    .join("\n");

  const prompt = `STUDENT RESULTS

Total questions: ${summary.total}
Mastered (first try, no hint): ${summary.mastered} (${summary.accuracy_pct}%)
Lucky (right after hint): ${summary.lucky}
Soft miss (right on second try): ${summary.soft_miss}
Hard miss (wrong both tries): ${summary.hard_miss}
Effective accuracy (would likely get on exam): ${summary.effective_pct}%

Per section:
${sectionLines}

Strongest concepts:
${strong || "(none yet)"}

Weakest concepts to drill:
${weak || "(none — clean run)"}

${summary.total <= 4 ? "NOTE: Very short run — acknowledge limited sample size in the note." : ""}

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
    return t.length > 30 ? t : FALLBACK(summary);
  } catch (e) {
    console.error("tutor letter ai", e);
    return FALLBACK(summary);
  }
}
