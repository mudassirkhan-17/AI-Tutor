import { createClient } from "@/lib/supabase/server";
import { SECTIONS, type SectionCode } from "@/lib/constants";

export type SectionMastery = {
  code: SectionCode;
  title: string;
  group: "National" | "State";
  total: number;
  correct: number;
  accuracy: number; // 0-100
};

export type UserStats = {
  totalAttempts: number;
  totalCorrect: number;
  overallAccuracy: number;
  sevenDayAccuracy: number;
  attemptsToday: number;
  streakDays: number;
  readinessScore: number;
  mastery: SectionMastery[];
  recentSessions: {
    id: string;
    mode: string;
    started_at: string;
    finished_at: string | null;
    score_pct: number | null;
    duration_ms: number | null;
  }[];
  dailyActivity: { day: string; attempts: number; correct: number }[]; // last 70 days
  sparkline: number[]; // last 14 days accuracy
  topStrengths: SectionMastery[];
  topWeaknesses: SectionMastery[];
  unresolvedMistakes: number;
};

export async function getUserStats(userId: string): Promise<UserStats> {
  const supabase = await createClient();

  const [
    { data: masteryRows },
    { data: recent },
    { data: daily },
    { count: mistakesCount },
    { data: allAttempts },
    { data: last7Attempts },
    { count: todayCount },
  ] = await Promise.all([
    supabase.from("v_user_section_mastery").select("*").eq("user_id", userId),
    supabase
      .from("sessions")
      .select("id, mode, started_at, finished_at, score_pct, duration_ms")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(8),
    supabase
      .from("v_user_daily_activity")
      .select("day, attempts, correct")
      .eq("user_id", userId)
      .gte("day", new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("day", { ascending: true }),
    supabase
      .from("v_user_mistakes")
      .select("question_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("resolved", false),
    supabase
      .from("attempts")
      .select("is_correct")
      .eq("user_id", userId),
    supabase
      .from("attempts")
      .select("is_correct")
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", new Date(new Date().toDateString()).toISOString()),
  ]);

  const totalAttempts = allAttempts?.length ?? 0;
  const totalCorrect = allAttempts?.filter((a) => a.is_correct).length ?? 0;
  const overallAccuracy = totalAttempts
    ? Math.round((100 * totalCorrect) / totalAttempts)
    : 0;
  const sevenDayAccuracy =
    last7Attempts?.length
      ? Math.round(
          (100 * last7Attempts.filter((a) => a.is_correct).length) /
            last7Attempts.length,
        )
      : 0;
  const attemptsToday = todayCount ?? 0;

  // mastery
  const masteryMap = new Map<string, { total: number; correct: number; accuracy: number }>();
  for (const row of masteryRows ?? []) {
    masteryMap.set((row as { section_code: string }).section_code, {
      total: (row as { total: number }).total,
      correct: (row as { correct: number }).correct,
      accuracy: Number((row as { accuracy: number | null }).accuracy ?? 0),
    });
  }
  const mastery: SectionMastery[] = SECTIONS.map((s) => {
    const m = masteryMap.get(s.code);
    return {
      code: s.code,
      title: s.title,
      group: s.group,
      total: m?.total ?? 0,
      correct: m?.correct ?? 0,
      accuracy: Math.round(m?.accuracy ?? 0),
    };
  });
  const attempted = mastery.filter((m) => m.total > 0);
  const topStrengths = [...attempted]
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3);
  const topWeaknesses = [...attempted]
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  // streak
  const daysSet = new Set(
    (daily ?? []).map((d) => (d as { day: string }).day as string),
  );
  let streakDays = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (daysSet.has(key)) streakDays++;
    else if (i > 0) break; // break on first gap (but allow today to be missed)
  }

  // sparkline (last 14 days accuracy)
  const sparkline: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayRow = (daily ?? []).find(
      (x) => (x as { day: string }).day === key,
    ) as { attempts: number; correct: number } | undefined;
    if (!dayRow || !dayRow.attempts) sparkline.push(0);
    else sparkline.push(Math.round((100 * dayRow.correct) / dayRow.attempts));
  }

  // readiness score: weighted composite (0-100)
  const mockLast = (recent ?? []).find((r) => r.mode === "mock");
  const coverageCount = attempted.length;
  const coverageScore = Math.min(100, Math.round((coverageCount / SECTIONS.length) * 100));
  const readinessScore = Math.round(
    0.45 * overallAccuracy +
      0.25 * (mockLast?.score_pct ?? 0) +
      0.15 * sevenDayAccuracy +
      0.15 * coverageScore,
  );

  return {
    totalAttempts,
    totalCorrect,
    overallAccuracy,
    sevenDayAccuracy,
    attemptsToday,
    streakDays,
    readinessScore,
    mastery,
    recentSessions: recent ?? [],
    dailyActivity: ((daily ?? []) as { day: string; attempts: number; correct: number }[]) || [],
    sparkline,
    topStrengths,
    topWeaknesses,
    unresolvedMistakes: mistakesCount ?? 0,
  };
}
