import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserStats } from "@/lib/kpi/stats";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiStatCard } from "@/components/kpi/kpi-stat-card";
import { MasteryMap } from "@/components/kpi/mastery-map";
import { StrengthsWeaknesses } from "@/components/kpi/strengths-weaknesses";
import { ActivityHeatmap } from "@/components/kpi/activity-heatmap";
import { ReadinessRing } from "@/components/kpi/readiness-ring";
import { StreakFlame } from "@/components/kpi/streak-flame";
import { ModeCards } from "@/components/kpi/mode-cards";
import {
  TrendingUp,
  Target,
  Flame,
  Activity,
  Sparkles,
  Clock3,
} from "lucide-react";
import { formatMs } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, target_exam_date")
    .eq("id", user.id)
    .maybeSingle();

  const stats = await getUserStats(user.id);
  const firstName = (profile?.full_name ?? user.email ?? "")
    .split(/[\s@]/)[0]
    ?.replace(/^./, (c) => c.toUpperCase());

  const next = getNextBestAction(stats);

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm text-ink-muted">Welcome back{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            Here&apos;s your study pulse.
          </h1>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/practice">Start practice</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/mock-exam">Mock exam</Link>
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiStatCard
          label="Overall accuracy"
          value={stats.overallAccuracy}
          suffix="%"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          spark={stats.sparkline}
          delta={
            stats.sevenDayAccuracy && stats.overallAccuracy
              ? Math.round(stats.sevenDayAccuracy - stats.overallAccuracy)
              : null
          }
          index={0}
        />
        <KpiStatCard
          label="Questions attempted"
          value={stats.totalAttempts}
          icon={<Target className="h-3.5 w-3.5" />}
          index={1}
        />
        <KpiStatCard
          label="Study streak"
          value={stats.streakDays}
          suffix={stats.streakDays === 1 ? "day" : "days"}
          icon={<Flame className="h-3.5 w-3.5" />}
          index={2}
        />
        <KpiStatCard
          label="Readiness"
          value={stats.readinessScore}
          suffix="/100"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          index={3}
        />
      </div>

      {/* Modes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-2xl font-semibold">Jump back in</h2>
        </div>
        <ModeCards />
      </div>

      {/* Mastery + Readiness */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mastery Map</CardTitle>
                <CardDescription>
                  Your accuracy across every section from A1 to B6.
                </CardDescription>
              </div>
              <Badge variant="outline">{stats.mastery.filter((m) => m.total > 0).length}/12 covered</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <MasteryMap mastery={stats.mastery} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Readiness score</CardTitle>
            <CardDescription>How ready you are for the exam right now.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReadinessRing value={stats.readinessScore} />
          </CardContent>
        </Card>
      </div>

      {/* Strengths / Heatmap */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Strengths &amp; focus areas</CardTitle>
            <CardDescription>
              Where you&apos;re crushing it, and where to spend your next session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StrengthsWeaknesses
              strengths={stats.topStrengths}
              weaknesses={stats.topWeaknesses}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Activity</CardTitle>
                <CardDescription>Last 10 weeks.</CardDescription>
              </div>
              <StreakFlame days={stats.streakDays} />
            </div>
          </CardHeader>
          <CardContent>
            <ActivityHeatmap days={stats.dailyActivity} />
          </CardContent>
        </Card>
      </div>

      {/* Next action + Recent */}
      <div className="grid lg:grid-cols-[1fr_1.5fr] gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 mesh-gradient opacity-25" aria-hidden />
          <CardHeader className="relative">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle>Next best action</CardTitle>
            </div>
            <CardDescription>Based on your current pulse.</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <p className="text-ink font-medium text-lg leading-snug">{next.title}</p>
            <p className="text-sm text-ink-muted mt-1">{next.detail}</p>
            <div className="mt-4">
              <Button asChild>
                <Link href={next.href}>{next.cta}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
            <CardDescription>Your last eight sessions across all modes.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentSessions.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nothing yet. Start with the Assessment to map your strengths.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {stats.recentSessions.map((s) => {
                  const finished = !!s.finished_at;
                  const resultsHref =
                    s.mode === "practice"
                      ? `/practice/${s.id}/results`
                      : s.mode === "mock"
                        ? `/mock-exam/${s.id}/results`
                        : s.mode === "final"
                          ? `/final-test/${s.id}/results`
                          : s.mode === "mistakes"
                            ? `/mistakes/${s.id}/results`
                            : `/assessment/${s.id}/results`;
                  const runnerHref = resultsHref.replace("/results", "");
                  return (
                    <div
                      key={s.id}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {s.mode}
                          </Badge>
                          <span className="text-xs text-ink-muted">
                            {new Date(s.started_at).toLocaleDateString()}
                          </span>
                        </div>
                        {finished && (
                          <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-2">
                            <Clock3 className="h-3 w-3" />
                            {formatMs(s.duration_ms ?? 0)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {finished ? (
                          <>
                            <div className="text-right">
                              <div className="font-serif text-lg tabular-nums">
                                {Math.round(Number(s.score_pct ?? 0))}%
                              </div>
                            </div>
                            <Button asChild size="sm" variant="outline">
                              <Link href={resultsHref}>Review</Link>
                            </Button>
                          </>
                        ) : (
                          <Button asChild size="sm">
                            <Link href={runnerHref}>Resume</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {stats.unresolvedMistakes > 0 && (
        <Card>
          <CardContent className="py-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-warn/15 grid place-items-center">
                <Activity className="h-4 w-4 text-warn" />
              </div>
              <div>
                <p className="font-medium text-ink">
                  You have {stats.unresolvedMistakes} unresolved mistake{stats.unresolvedMistakes === 1 ? "" : "s"}.
                </p>
                <p className="text-sm text-ink-muted">
                  Drill them until they stick.
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/mistakes">Start Mistakes Test</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getNextBestAction(stats: Awaited<ReturnType<typeof getUserStats>>) {
  if (stats.totalAttempts === 0) {
    return {
      title: "Take the 24-question Assessment.",
      detail: "It covers every section so we can map your strengths and gaps in about 15 minutes.",
      cta: "Start Assessment",
      href: "/assessment",
    };
  }
  if (stats.unresolvedMistakes >= 5) {
    return {
      title: `Drill your ${stats.unresolvedMistakes} unresolved mistakes.`,
      detail: "Nothing moves the needle faster than fixing the same misses.",
      cta: "Start Mistakes Test",
      href: "/mistakes",
    };
  }
  if (stats.topWeaknesses.length > 0) {
    const w = stats.topWeaknesses[0];
    return {
      title: `Drill ${w.code}: ${w.title} — you're at ${w.accuracy}%.`,
      detail: "Jump into a Practice session focused on raising this weak spot.",
      cta: "Practice now",
      href: "/practice",
    };
  }
  if (stats.readinessScore >= 70) {
    return {
      title: "You're close. Take a timed Mock Exam.",
      detail: "Simulate the real SC exam: 120 questions in 240 minutes.",
      cta: "Start Mock Exam",
      href: "/mock-exam",
    };
  }
  return {
    title: "Keep building volume with Practice.",
    detail: "A few more sessions and the readiness score will climb fast.",
    cta: "Practice",
    href: "/practice",
  };
}
