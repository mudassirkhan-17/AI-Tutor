import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionRow } from "@/lib/supabase/types";
import { shuffle } from "@/lib/utils";

/**
 * Build a balanced assessment set:
 *  - For each section, fetch a wide pool then sample by difficulty.
 *  - Difficulty mix is roughly 30% easy / 50% medium / 20% hard.
 *  - Falls back gracefully when a section is light on a level.
 *  - Across-section ordering: interleave by section so the user
 *    doesn't sit on one topic for 35 questions in a row.
 */
export async function pickAssessmentQuestions(
  supabase: SupabaseClient,
  sections: string[],
  perSection: number,
): Promise<QuestionRow[]> {
  const want = mixForCount(perSection);

  const buckets: Record<string, QuestionRow[]> = {};

  await Promise.all(
    sections.map(async (code) => {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("section_code", code)
        .eq("pool", "standard")
        .limit(1000);

      if (error || !data) {
        buckets[code] = [];
        return;
      }

      const easy = shuffle(data.filter((q) => q.level === "easy")) as QuestionRow[];
      const med = shuffle(data.filter((q) => q.level === "medium")) as QuestionRow[];
      const hard = shuffle(data.filter((q) => q.level === "hard")) as QuestionRow[];

      const picked: QuestionRow[] = [];
      picked.push(...easy.slice(0, want.easy));
      picked.push(...med.slice(0, want.medium));
      picked.push(...hard.slice(0, want.hard));

      // Backfill from any remaining if a level was short
      const usedIds = new Set(picked.map((q) => q.id));
      const leftover = shuffle(
        (data as QuestionRow[]).filter((q) => !usedIds.has(q.id)),
      );
      while (picked.length < perSection && leftover.length) {
        picked.push(leftover.shift()!);
      }

      // Concept diversity: prefer one question per concept where possible
      buckets[code] = preferConceptDiversity(picked, perSection);
    }),
  );

  // Interleave so sections rotate
  const queues = sections.map((s) => [...buckets[s]]);
  const out: QuestionRow[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      if (q.length) {
        out.push(q.shift()!);
        added = true;
      }
    }
  }
  return out;
}

/** Exactly `count` questions, round-robin across picked sections (for smoke / dev runs). */
export async function pickSmokeAssessmentQuestions(
  supabase: SupabaseClient,
  sections: string[],
  count: number,
): Promise<QuestionRow[]> {
  if (count < 1 || sections.length === 0) return [];

  const pools = await Promise.all(
    sections.map(async (code) => {
      const { data } = await supabase
        .from("questions")
        .select("*")
        .eq("section_code", code)
        .eq("pool", "standard")
        .limit(400);
      return shuffle((data ?? []) as QuestionRow[]);
    }),
  );

  const idxBySection = sections.map(() => 0);
  const used = new Set<string>();
  const out: QuestionRow[] = [];

  let cursor = 0;
  let stall = 0;
  const maxStall = Math.max(200, sections.length * 500);

  while (out.length < count && stall < maxStall) {
    const si = cursor % sections.length;
    const pool = pools[si]!;
    let took = false;
    while (idxBySection[si]! < pool.length && out.length < count) {
      const q = pool[idxBySection[si]!]!;
      idxBySection[si]! += 1;
      if (used.has(q.id)) continue;
      out.push(q);
      used.add(q.id);
      took = true;
      stall = 0;
      break;
    }
    if (!took) stall += 1;
    cursor += 1;
  }

  return out;
}

function mixForCount(n: number) {
  // 30 / 50 / 20
  const easy = Math.round(n * 0.3);
  const hard = Math.round(n * 0.2);
  const medium = Math.max(0, n - easy - hard);
  return { easy, medium, hard };
}

function preferConceptDiversity(
  picks: QuestionRow[],
  cap: number,
): QuestionRow[] {
  const seen = new Map<string, number>();
  const primary: QuestionRow[] = [];
  const overflow: QuestionRow[] = [];
  for (const q of picks) {
    const key = q.concept_id ?? `__${q.section_code}_${q.id}`;
    const seenCount = seen.get(key) ?? 0;
    if (seenCount === 0) {
      primary.push(q);
      seen.set(key, 1);
    } else {
      overflow.push(q);
      seen.set(key, seenCount + 1);
    }
  }
  return [...primary, ...overflow].slice(0, cap);
}
