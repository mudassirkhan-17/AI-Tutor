import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mock Exam unlocks after a *substantive* Mistakes Test.
 *
 * Substantive = session with status='finished' AND at least
 * COMPLETION_RATIO of its configured questions actually answered
 * (non-sibling, so extra tries don't inflate the count).
 *
 * Examples:
 *   - Full mistakes (110 Q):   ≥ 88 primary attempts unlocks Mock.
 *   - Smoke mistakes (10 Q):   ≥ 8 primary attempts unlocks Mock.
 *
 * Sessions with no recorded length fall back to MIN_FALLBACK_ATTEMPTS so
 * legacy rows don't open the gate accidentally.
 */
const COMPLETION_RATIO = 0.8;
const MIN_FALLBACK_ATTEMPTS = 8;

type FinishedSession = {
  id: string;
  config: { question_ids?: string[]; target_total?: number } | null;
};

async function getFinishedMistakesSessions(
  supabase: SupabaseClient,
  userId: string,
): Promise<FinishedSession[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, config")
    .eq("user_id", userId)
    .eq("mode", "mistakes")
    .eq("status", "finished")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(15);
  if (error) return [];
  return (data ?? []) as FinishedSession[];
}

async function countPrimaryAttempts(
  supabase: SupabaseClient,
  sessionIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!sessionIds.length) return counts;
  const { data } = await supabase
    .from("attempts")
    .select("session_id")
    .in("session_id", sessionIds)
    .eq("is_sibling", false);
  for (const a of (data ?? []) as { session_id: string }[]) {
    counts.set(a.session_id, (counts.get(a.session_id) ?? 0) + 1);
  }
  return counts;
}

function thresholdFor(session: FinishedSession): number {
  const cfgTotal =
    session.config?.target_total ??
    session.config?.question_ids?.length ??
    0;
  if (cfgTotal > 0) {
    return Math.max(1, Math.ceil(cfgTotal * COMPLETION_RATIO));
  }
  return MIN_FALLBACK_ATTEMPTS;
}

export async function hasFinishedMistakes(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const sessions = await getFinishedMistakesSessions(supabase, userId);
  if (!sessions.length) return false;

  const counts = await countPrimaryAttempts(
    supabase,
    sessions.map((s) => s.id),
  );

  for (const s of sessions) {
    const need = thresholdFor(s);
    const got = counts.get(s.id) ?? 0;
    if (got >= need) return true;
  }
  return false;
}

/** Closest-to-threshold finished mistakes run, for lock-screen copy. */
export async function getMistakesProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  done: boolean;
  bestSessionAttempts: number;
  bestSessionTotal: number;
  bestSessionThreshold: number;
}> {
  const sessions = await getFinishedMistakesSessions(supabase, userId);
  if (!sessions.length) {
    return {
      done: false,
      bestSessionAttempts: 0,
      bestSessionTotal: 0,
      bestSessionThreshold: 0,
    };
  }
  const counts = await countPrimaryAttempts(
    supabase,
    sessions.map((s) => s.id),
  );

  let bestRatio = -1;
  let best = { attempts: 0, total: 0, threshold: 0 };
  for (const s of sessions) {
    const total =
      s.config?.target_total ?? s.config?.question_ids?.length ?? 0;
    const threshold = thresholdFor(s);
    const got = counts.get(s.id) ?? 0;
    const denom = total > 0 ? total : Math.max(threshold, 1);
    const ratio = got / denom;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = { attempts: got, total, threshold };
    }
  }

  return {
    done: best.attempts >= best.threshold,
    bestSessionAttempts: best.attempts,
    bestSessionTotal: best.total,
    bestSessionThreshold: best.threshold,
  };
}
