import { z } from "zod";

/**
 * DebriefPlan — the agent's proposed (and user-confirmable) plan for the
 * NEXT practice run after a test.
 *
 * Semantics:
 *   - `total`: how many questions next practice should have (10–110).
 *   - `focus`: section codes the student wants explicitly amplified. Each
 *     focus section gets a weight multiplier (default 2.0) and a minimum
 *     floor so it can't be starved by the weakness signal.
 *   - `avoid`: section codes to downweight (multiplier 0.4). Still not
 *     zeroed — exam coverage matters.
 *   - `difficultyBias`:
 *       "mix"    → default weakness-blended mix.
 *       "harder" → shift one notch toward hard (+10% hard, −5% easy/med).
 *       "review" → shift toward easy/medium (recovery run).
 *   - `note`: one-line human explanation the agent wrote; shown as caption.
 *
 * All fields optional so the validator is forgiving to partial tool calls.
 */
export const DebriefPlanSchema = z.object({
  total: z.number().int().min(5).max(110).optional(),
  focus: z.array(z.string()).max(12).optional(),
  avoid: z.array(z.string()).max(12).optional(),
  difficultyBias: z.enum(["mix", "harder", "review"]).optional(),
  note: z.string().max(280).optional(),
});

export type DebriefPlan = z.infer<typeof DebriefPlanSchema>;

export const DEFAULT_PLAN: DebriefPlan = {
  total: 30,
  focus: [],
  avoid: [],
  difficultyBias: "mix",
  note: "",
};

/** Boost a focus section gets over default weakness weight. */
export const FOCUS_MULTIPLIER = 2.0;
/** Multiplier applied to avoided sections (kept >0 to preserve coverage). */
export const AVOID_MULTIPLIER = 0.4;
/** Minimum questions a focus section must receive, when total is ≥ 15. */
export const FOCUS_FLOOR = 4;

export function sanitizePlan(p: Partial<DebriefPlan> | null | undefined): DebriefPlan {
  const raw = DebriefPlanSchema.safeParse(p ?? {});
  const data = raw.success ? raw.data : {};
  return {
    total: data.total ?? DEFAULT_PLAN.total,
    focus: Array.from(new Set((data.focus ?? []).map((s) => s.toUpperCase()))),
    avoid: Array.from(new Set((data.avoid ?? []).map((s) => s.toUpperCase()))),
    difficultyBias: data.difficultyBias ?? "mix",
    note: (data.note ?? "").trim(),
  };
}
