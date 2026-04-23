import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Journey" data: a chronological view of a student's finished sessions
 * across the three iterative modes (Assessment → Practice → Mistakes →
 * Mock). Used by the per-mode results pages to show progress across the
 * whole funnel, not just the run that just finished.
 *
 * We deliberately exclude `final` here — Final Test is the destination,
 * it gets its own report and shouldn't dilute the practice journey view.
 */
export type JourneyMode = "assessment" | "practice" | "mistakes" | "mock";

export type JourneyPoint = {
  id: string;
  mode: JourneyMode;
  started_at: string;
  finished_at: string | null;
  /** 0-100 (rounded), or null for sessions without a score yet. */
  score_pct: number | null;
  duration_ms: number | null;
};

export type ModeSeries = {
  mode: JourneyMode;
  /** Most-recent first. */
  runs: JourneyPoint[];
  /** Latest finished score, null if none. */
  latest: number | null;
  /** Best finished score, null if none. */
  best: number | null;
  /** latest - previous, or null with <2 data points. */
  delta: number | null;
};

export type Journey = {
  perMode: Record<JourneyMode, ModeSeries>;
  /** Up to 24 most recent finished sessions across the four modes. */
  combined: JourneyPoint[];
};

const MODES: JourneyMode[] = ["assessment", "practice", "mistakes", "mock"];

export async function loadJourney(
  supabase: SupabaseClient,
  userId: string,
  opts?: { perModeLimit?: number; combinedLimit?: number },
): Promise<Journey> {
  const perModeLimit = opts?.perModeLimit ?? 12;
  const combinedLimit = opts?.combinedLimit ?? 24;

  const { data: rows } = await supabase
    .from("sessions")
    .select("id, mode, started_at, finished_at, score_pct, duration_ms, status")
    .eq("user_id", userId)
    .in("mode", MODES)
    .eq("status", "finished")
    .order("started_at", { ascending: false })
    .limit(perModeLimit * MODES.length);

  const perMode: Record<JourneyMode, ModeSeries> = Object.fromEntries(
    MODES.map((m) => [
      m,
      { mode: m, runs: [], latest: null, best: null, delta: null } as ModeSeries,
    ]),
  ) as Record<JourneyMode, ModeSeries>;

  for (const r of (rows ?? []) as Array<{
    id: string;
    mode: JourneyMode;
    started_at: string;
    finished_at: string | null;
    score_pct: number | null;
    duration_ms: number | null;
  }>) {
    const series = perMode[r.mode];
    if (!series) continue;
    if (series.runs.length >= perModeLimit) continue;
    series.runs.push({
      id: r.id,
      mode: r.mode,
      started_at: r.started_at,
      finished_at: r.finished_at,
      score_pct: r.score_pct == null ? null : Math.round(Number(r.score_pct)),
      duration_ms: r.duration_ms,
    });
  }

  for (const m of MODES) {
    const s = perMode[m];
    const scored = s.runs.filter((r) => r.score_pct != null) as (JourneyPoint & {
      score_pct: number;
    })[];
    if (scored.length) {
      s.latest = scored[0].score_pct;
      s.best = scored.reduce(
        (acc, r) => (r.score_pct > acc ? r.score_pct : acc),
        -Infinity,
      );
      if (s.best === -Infinity) s.best = null;
      s.delta = scored.length >= 2 ? scored[0].score_pct - scored[1].score_pct : null;
    }
  }

  const combined: JourneyPoint[] = (rows ?? [])
    .slice(0, combinedLimit)
    .map((r) => {
      const row = r as {
        id: string;
        mode: JourneyMode;
        started_at: string;
        finished_at: string | null;
        score_pct: number | null;
        duration_ms: number | null;
      };
      return {
        id: row.id,
        mode: row.mode,
        started_at: row.started_at,
        finished_at: row.finished_at,
        score_pct: row.score_pct == null ? null : Math.round(Number(row.score_pct)),
        duration_ms: row.duration_ms,
      };
    })
    .reverse(); // chronological for the chart

  return { perMode, combined };
}
