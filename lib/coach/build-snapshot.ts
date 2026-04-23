import { SECTIONS } from "@/lib/constants";

const SECTION_TITLE: Record<string, string> = Object.fromEntries(
  SECTIONS.map((s) => [s.code, s.title]),
);

export type SnapshotSection = {
  code: string;
  title?: string;
  total: number;
  correct: number;
  accuracy?: number | null;
  baselineAccuracy?: number | null;
};

export type CoachSnapshot = {
  mode: "assessment" | "practice" | "mistakes" | "mock" | "final";
  sessionId: string;
  total: number;
  correct: number;
  accuracy: number;
  passBar?: number | null;
  durationMs?: number | null;
  hintUsed?: number | null;
  coachedPct?: number | null;
  bySection: SnapshotSection[];
  weakestCodes: string[];
  strongestCodes: string[];
  prior?: { label: string; accuracy?: number | null } | null;
};

/**
 * Given per-section breakdowns (with optional baselines) return the 3 weakest
 * and 3 strongest section codes. Sections with no attempts are ignored. When
 * baseline is present, we prefer the largest negative delta as "weakest" so
 * regressions surface even if absolute accuracy isn't the worst.
 */
export function rankSections(
  sections: SnapshotSection[],
): { weakest: string[]; strongest: string[] } {
  const scored = sections
    .filter((s) => s.total > 0 && s.accuracy != null)
    .map((s) => {
      const acc = s.accuracy ?? 0;
      const baseline = s.baselineAccuracy ?? null;
      const deltaPenalty = baseline != null ? Math.max(0, baseline - acc) * 0.5 : 0;
      return { code: s.code, acc, score: acc - deltaPenalty };
    });
  const byWeak = [...scored].sort((a, b) => a.score - b.score);
  const byStrong = [...scored].sort((a, b) => b.acc - a.acc);
  return {
    weakest: byWeak.slice(0, 3).map((x) => x.code),
    strongest: byStrong.slice(0, 3).map((x) => x.code),
  };
}

export function enrichSections(
  bySection: SnapshotSection[],
): SnapshotSection[] {
  return bySection.map((s) => ({
    ...s,
    title: s.title ?? SECTION_TITLE[s.code] ?? s.code,
  }));
}
