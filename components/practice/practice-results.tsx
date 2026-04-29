"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Trophy,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Lightbulb,
  Timer,
  Target,
  Gauge,
  AlertTriangle,
  GraduationCap,
  ArrowRight,
  Zap,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatMs } from "@/lib/utils";
import { useChatSheet } from "@/components/chat/chat-sheet-provider";
import { toast } from "sonner";
import type { PracticeStats, PracticeReviewItem } from "@/lib/practice/results";
import type { PracticeBaseline } from "@/lib/practice/baseline";
import type { Journey } from "@/lib/journey/load";
import { JourneyPanel } from "@/components/results/journey-panel";
import { DebriefPanel } from "@/components/coach/debrief-panel";
import type { DebriefPlan } from "@/lib/coach/debrief-plan";
import { rankSections, enrichSections } from "@/lib/coach/build-snapshot";

type Props = {
  sessionId: string;
  durationMs: number;
  stats: PracticeStats;
  baseline: PracticeBaseline;
  sectionTitles: Record<string, string>;
  aiNote: string;
  journey?: Journey;
  initialPlan?: DebriefPlan | null;
  initialPlanCommitted?: boolean;
};

/* =====================================================================
 * PracticeResultsView
 *
 * The full post-practice screen. Layout (top → bottom):
 *
 *   1. HERO — composition ring, headline percentages, action row.
 *   2. KPI grid — first-try, reach, coached, recovery.
 *   3. AI note (Socratic, no answer reveals).
 *   4. vs Assessment delta panel — per-section bar with arrows.
 *   5. Two-up: difficulty mix + run trend.
 *   6. Speed insight + section breakdown.
 *   7. Question review (collapsible).
 *
 * All charts are inline SVG (no chart lib). Color tokens come from
 * Tailwind theme (`success`, `warn`, `danger`, `primary`).
 * ===================================================================== */
export function PracticeResultsView({
  sessionId,
  durationMs,
  stats,
  baseline,
  sectionTitles,
  aiNote,
  journey,
  initialPlan,
  initialPlanCommitted,
}: Props) {
  const sectionSnapshot = enrichSections(
    stats.bySection.map((s) => {
      const b = baseline.bySection?.[s.code];
      return {
        code: s.code,
        title: sectionTitles[s.code],
        total: s.total,
        correct: s.correct,
        accuracy: s.accuracy,
        baselineAccuracy: b?.accuracy ?? null,
      };
    }),
  );
  const { weakest, strongest } = rankSections(sectionSnapshot);
  const debriefSnapshot = {
    mode: "practice" as const,
    sessionId,
    total: stats.total,
    correct: stats.mastered + stats.soft,
    accuracy: stats.reach_pct,
    passBar: null,
    durationMs,
    hintUsed: stats.hint_count,
    coachedPct: stats.coached_pct,
    bySection: sectionSnapshot,
    weakestCodes: weakest,
    strongestCodes: strongest,
    prior:
      baseline.source === "assessment"
        ? { label: "Assessment", accuracy: null }
        : baseline.source === "lifetime"
          ? { label: "Lifetime", accuracy: null }
          : null,
  };

  return (
    <div className="space-y-6">
      <Hero stats={stats} durationMs={durationMs} sessionId={sessionId} />
      <DebriefPanel
        snapshot={debriefSnapshot}
        initialPlan={initialPlan}
        initialCommitted={initialPlanCommitted}
      />
      <KpiGrid stats={stats} />
      <AINotePanel note={aiNote} />
      {journey && <JourneyPanel journey={journey} currentSessionId={sessionId} />}
      <ComparisonPanel
        stats={stats}
        baseline={baseline}
        sectionTitles={sectionTitles}
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <DifficultyCard stats={stats} />
        <TrendCard stats={stats} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <SpeedCard stats={stats} durationMs={durationMs} />
        <RecoveryCard stats={stats} />
      </div>

      <SectionBreakdown
        stats={stats}
        baseline={baseline}
        sectionTitles={sectionTitles}
      />

      <QuestionReview review={stats.review} />
    </div>
  );
}

/* ===================================================================== */
/*  HERO                                                                  */
/* ===================================================================== */

function Hero({ stats, durationMs, sessionId }: { stats: PracticeStats; durationMs: number; sessionId: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 md:p-10 shadow-soft"
    >
      <div className="absolute inset-0 mesh-gradient opacity-25" aria-hidden />
      <div
        className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl pointer-events-none"
        aria-hidden
      />

      <div className="relative grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
        <CompositionRing stats={stats} />

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">Practice results</Badge>
            <Badge variant="outline" className="text-ink-muted">
              {stats.total} question{stats.total === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline" className="text-ink-muted">
              {formatMs(durationMs)}
            </Badge>
          </div>

          <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-ink leading-tight">
            {greet(stats)}
          </h1>

          <div className="grid grid-cols-2 gap-3 max-w-xl">
            <HeadlineMetric
              icon={Target}
              label="First-try mastery"
              caption="Solo, no hint, no coach."
              value={stats.strict_pct}
              tone={stats.strict_pct >= 70 ? "success" : stats.strict_pct >= 50 ? "warn" : "danger"}
            />
            <HeadlineMetric
              icon={Gauge}
              label="Reach"
              caption="Mastered + recovered after AI follow-up."
              value={stats.reach_pct}
              tone={stats.reach_pct >= 70 ? "success" : stats.reach_pct >= 50 ? "warn" : "danger"}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
            <Button asChild>
              <Link href="/practice">
                <RotateCcw className="h-4 w-4" /> Run another
              </Link>
            </Button>
            {stats.hard > 0 && (
              <Button asChild variant="soft">
                <Link href="/mistakes">
                  <Flame className="h-4 w-4" /> Drill {stats.hard} miss{stats.hard === 1 ? "" : "es"}
                </Link>
              </Button>
            )}
            <DownloadPdfButton sessionId={sessionId} />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function greet(s: PracticeStats): string {
  if (!s.total) return "Run complete.";
  if (s.strict_pct >= 80) return "Sharp run — that's exam-ready territory.";
  if (s.strict_pct >= 65) return "Solid first-try mastery, with room to push.";
  if (s.strict_pct >= 45) return "Material is in reach — let's tighten the gaps.";
  return "Honest run. We have a clear list to drill.";
}

function CompositionRing({ stats }: { stats: PracticeStats }) {
  const size = 200;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const total = Math.max(1, stats.total);
  const seg = (n: number) => (100 * n) / total;

  const segs = [
    { value: seg(stats.mastered), cls: "text-success" },
    { value: seg(stats.soft), cls: "text-warn" },
    { value: seg(stats.hard), cls: "text-danger" },
  ];

  let offset = 0;
  const center = size / 2;

  return (
    <div className="relative shrink-0 mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          className="text-ink"
          strokeOpacity={0.08}
        />
        {segs.map((s, i) => {
          if (s.value <= 0) return null;
          const dasharray = `${s.value} ${100 - s.value}`;
          const dashoffset = -offset;
          offset += s.value;
          return (
            <motion.circle
              key={i}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              pathLength={100}
              strokeWidth={stroke}
              stroke="currentColor"
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              strokeLinecap="butt"
              className={s.cls}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.12, duration: 0.6, ease: "easeOut" }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="text-center">
          <div className="font-serif text-5xl font-semibold tabular-nums text-ink leading-none">
            {stats.reach_pct}
            <span className="text-2xl text-ink-muted">%</span>
          </div>
          <div className="text-[11px] uppercase tracking-widest text-ink-muted mt-2">
            reach
          </div>
          <div className="mt-3 inline-flex items-center gap-2 text-[11px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-success" />
              {stats.mastered}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-warn" />
              {stats.soft}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-danger" />
              {stats.hard}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeadlineMetric({
  icon: Icon,
  label,
  caption,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  caption: string;
  value: number;
  tone: "success" | "warn" | "danger";
}) {
  const toneCls =
    tone === "success" ? "text-success" : tone === "warn" ? "text-warn" : "text-danger";
  const trackCls =
    tone === "success" ? "bg-success" : tone === "warn" ? "bg-warn" : "bg-danger";
  return (
    <div className="rounded-2xl border border-border bg-elevated/40 p-3.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-ink-muted">
        <Icon className={cn("h-3.5 w-3.5", toneCls)} />
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-serif text-3xl font-semibold tabular-nums text-ink">
          {value}
        </span>
        <span className="text-base text-ink-muted">%</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn("h-full", trackCls)}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-ink-muted leading-snug">{caption}</p>
    </div>
  );
}

/* ===================================================================== */
/*  KPI GRID                                                              */
/* ===================================================================== */

function KpiGrid({ stats }: { stats: PracticeStats }) {
  const tiles: KpiTileProps[] = [
    {
      icon: CheckCircle2,
      tone: "success",
      label: "Locked in",
      value: stats.mastered,
      sub: `of ${stats.total} on first try`,
    },
    {
      icon: TrendingUp,
      tone: "warn",
      label: "Recovered",
      value: stats.soft,
      sub: `nailed the AI follow-up`,
    },
    {
      icon: AlertTriangle,
      tone: "danger",
      label: "Needs review",
      value: stats.hard,
      sub: `missed both tries`,
    },
    {
      icon: GraduationCap,
      tone: "primary",
      label: "Coached",
      value: `${stats.coached_pct}%`,
      sub: `${stats.coached_count} of ${stats.total} used the tutor chat`,
    },
  ];
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map((t, i) => (
        <KpiTile key={t.label} {...t} index={i} />
      ))}
    </section>
  );
}

type KpiTileProps = {
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "warn" | "danger" | "primary";
  label: string;
  value: number | string;
  sub: string;
  index?: number;
};

function KpiTile({ icon: Icon, tone, label, value, sub, index = 0 }: KpiTileProps) {
  const toneCls =
    tone === "success"
      ? "text-success bg-success/10 border-success/20"
      : tone === "warn"
        ? "text-warn bg-warn/10 border-warn/20"
        : tone === "danger"
          ? "text-danger bg-danger/10 border-danger/20"
          : "text-primary bg-primary/10 border-primary/20";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
    >
      <Card className="h-full">
        <CardContent className="p-4 flex flex-col gap-2">
          <div
            className={cn(
              "h-9 w-9 grid place-items-center rounded-xl border",
              toneCls,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="font-serif text-3xl font-semibold tabular-nums text-ink leading-none">
            {value}
          </div>
          <div className="text-xs uppercase tracking-widest text-ink-muted">
            {label}
          </div>
          <div className="text-[11px] text-ink-muted leading-snug">{sub}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ===================================================================== */
/*  AI NOTE                                                               */
/* ===================================================================== */

function AINotePanel({ note }: { note: string }) {
  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary-soft/40 via-surface to-surface">
      <div
        className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl pointer-events-none"
        aria-hidden
      />
      <CardContent className="relative pt-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-8 w-8 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-soft">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-semibold text-ink">Coach&apos;s note</h3>
            <p className="text-xs text-ink-muted">
              Honest read on this run, written by your tutor.
            </p>
          </div>
        </div>
        <div className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap">
          {note}
        </div>
      </CardContent>
    </Card>
  );
}

/* ===================================================================== */
/*  vs ASSESSMENT                                                         */
/* ===================================================================== */

function ComparisonPanel({
  stats,
  baseline,
  sectionTitles,
}: {
  stats: PracticeStats;
  baseline: PracticeBaseline;
  sectionTitles: Record<string, string>;
}) {
  // Build delta rows for sections with both data points.
  type Row = {
    code: string;
    title: string;
    practice: number;
    before: number | null;
    delta: number | null;
    total: number;
  };
  const rows: Row[] = stats.bySection.map((s) => {
    const b = baseline.bySection[s.code];
    const before = b?.accuracy ?? null;
    const delta = before == null ? null : s.accuracy - before;
    return {
      code: s.code,
      title: sectionTitles[s.code] ?? s.code,
      practice: s.accuracy,
      before,
      delta,
      total: s.total,
    };
  });

  type KnownRow = Omit<Row, "delta" | "before"> & { delta: number; before: number };
  const known: KnownRow[] = rows.flatMap((r) =>
    r.delta != null && r.before != null
      ? [{ code: r.code, title: r.title, practice: r.practice, total: r.total, delta: r.delta, before: r.before }]
      : [],
  );
  const overallDelta = known.length
    ? Math.round(known.reduce((a, r) => a + r.delta, 0) / known.length)
    : null;
  const biggestUp = [...known].sort((a, b) => b.delta - a.delta)[0];
  const biggestDown = [...known].sort((a, b) => a.delta - b.delta)[0];

  const sourceLabel =
    baseline.source === "assessment"
      ? "vs your last Assessment"
      : baseline.source === "lifetime"
        ? "vs your lifetime accuracy"
        : "no prior baseline yet";

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Movement {sourceLabel}</h3>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Per-section first-try accuracy now vs the snapshot we have on
              file.
            </p>
          </div>

          {overallDelta != null && (
            <DeltaPill value={overallDelta} label="overall" />
          )}
        </div>

        {!known.length ? (
          <div className="rounded-2xl border border-dashed border-border bg-elevated/40 p-4 text-sm text-ink-muted">
            {baseline.source === "none"
              ? "Take an Assessment so we can show real movement next time you finish a Practice run."
              : "Not enough overlap with your prior data to chart per-section movement yet."}
          </div>
        ) : (
          <>
            {(biggestUp || biggestDown) && (
              <div className="grid sm:grid-cols-2 gap-2">
                {biggestUp && biggestUp.delta > 0 && (
                  <Highlight
                    tone="success"
                    icon={TrendingUp}
                    title={`${biggestUp.title} jumped`}
                    detail={`${biggestUp.before}% → ${biggestUp.practice}% (+${biggestUp.delta} pts)`}
                  />
                )}
                {biggestDown && biggestDown.delta < 0 && (
                  <Highlight
                    tone="danger"
                    icon={TrendingDown}
                    title={`${biggestDown.title} slipped`}
                    detail={`${biggestDown.before}% → ${biggestDown.practice}% (${biggestDown.delta} pts)`}
                  />
                )}
              </div>
            )}

            <div className="space-y-1.5">
              {rows.map((r) => (
                <DeltaBar key={r.code} row={r} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DeltaPill({ value, label }: { value: number; label: string }) {
  const tone =
    value > 0 ? "text-success bg-success/10" : value < 0 ? "text-danger bg-danger/10" : "text-ink-muted bg-elevated";
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium", tone)}>
      <Icon className="h-3.5 w-3.5" />
      <span className="tabular-nums">
        {value > 0 ? "+" : ""}
        {value} pts
      </span>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  );
}

function Highlight({
  tone,
  icon: Icon,
  title,
  detail,
}: {
  tone: "success" | "danger";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
}) {
  const cls =
    tone === "success"
      ? "border-success/25 bg-success/5"
      : "border-danger/25 bg-danger/5";
  const iconCls = tone === "success" ? "text-success" : "text-danger";
  return (
    <div className={cn("rounded-2xl border p-3 flex items-start gap-3", cls)}>
      <Icon className={cn("h-4 w-4 mt-0.5", iconCls)} />
      <div>
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="text-xs text-ink-muted">{detail}</div>
      </div>
    </div>
  );
}

function DeltaBar({
  row,
}: {
  row: {
    code: string;
    title: string;
    practice: number;
    before: number | null;
    delta: number | null;
    total: number;
  };
}) {
  const before = row.before ?? 0;
  const after = row.practice;
  const min = Math.min(before, after);
  const max = Math.max(before, after);
  const dir = row.delta == null ? 0 : Math.sign(row.delta);

  return (
    <div className="grid grid-cols-[64px_1fr_auto] items-center gap-3 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className="text-[10px]">
          {row.code}
        </Badge>
      </div>

      <div className="relative h-6 rounded-full bg-muted overflow-hidden">
        {row.before == null ? (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary/40"
            style={{ width: `${after}%` }}
          />
        ) : (
          <>
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-ink/15"
              style={{ width: `${before}%` }}
              title={`Baseline ${before}%`}
            />
            <div
              className={cn(
                "absolute inset-y-0 rounded-full",
                dir > 0
                  ? "bg-success/60"
                  : dir < 0
                    ? "bg-danger/60"
                    : "bg-primary/40",
              )}
              style={{ left: `${min}%`, width: `${Math.max(0.5, max - min)}%` }}
              title={`${dir > 0 ? "Gain" : dir < 0 ? "Drop" : "Flat"} band`}
            />
            <div
              className="absolute inset-y-0 w-[2px] bg-ink/60"
              style={{ left: `calc(${after}% - 1px)` }}
              title={`Practice ${after}%`}
            />
          </>
        )}
        <div className="absolute inset-0 flex items-center justify-end pr-2 text-[11px] font-medium tabular-nums text-ink">
          {after}%
        </div>
      </div>

      <div className="w-20 text-right text-xs">
        {row.before == null ? (
          <span className="text-ink-muted">no prior</span>
        ) : row.delta === 0 ? (
          <span className="text-ink-muted inline-flex items-center gap-1">
            <Minus className="h-3 w-3" /> flat
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium tabular-nums",
              row.delta! > 0 ? "text-success" : "text-danger",
            )}
          >
            {row.delta! > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {row.delta! > 0 ? "+" : ""}
            {row.delta}
          </span>
        )}
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  DIFFICULTY                                                            */
/* ===================================================================== */

function DifficultyCard({ stats }: { stats: PracticeStats }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Accuracy by difficulty</h3>
        </div>
        <div className="space-y-3">
          {stats.byDifficulty.map((d) => (
            <DifficultyRow key={d.level} d={d} />
          ))}
          {stats.byDifficulty.every((d) => d.total === 0) && (
            <p className="text-sm text-ink-muted">No data yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DifficultyRow({
  d,
}: {
  d: { level: "easy" | "medium" | "hard"; total: number; correct: number; accuracy: number };
}) {
  if (!d.total) {
    return (
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span className="capitalize">{d.level}</span>
        <span>—</span>
      </div>
    );
  }
  const tone =
    d.accuracy >= 80 ? "bg-success" : d.accuracy >= 60 ? "bg-warn" : "bg-danger";
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="capitalize text-ink font-medium">{d.level}</span>
        <span className="text-ink-muted tabular-nums">
          {d.correct}/{d.total} · {d.accuracy}%
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn("h-full", tone)}
          initial={{ width: 0 }}
          animate={{ width: `${d.accuracy}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  TREND                                                                 */
/* ===================================================================== */

function TrendCard({ stats }: { stats: PracticeStats }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">How the run unfolded</h3>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Rolling first-try accuracy as you went through the questions.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            ends at {stats.first_try_pct}%
          </Badge>
        </div>
        <TrendChart values={stats.trend} />
      </CardContent>
    </Card>
  );
}

function TrendChart({ values }: { values: number[] }) {
  if (!values.length) {
    return (
      <div className="text-sm text-ink-muted">No trend data.</div>
    );
  }
  const w = 600;
  const h = 140;
  const padX = 8;
  const padY = 8;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;
  const yFor = (v: number) => padY + innerH - (v / 100) * innerH;
  const points = values.map((v, i) => `${padX + i * stepX},${yFor(v)}`);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p}`).join(" ");
  const area =
    `${line} L ${padX + (values.length - 1) * stepX} ${padY + innerH} L ${padX} ${padY + innerH} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-[140px]"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="trendGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Pass-line guide at 70%. */}
      <line
        x1={padX}
        x2={padX + innerW}
        y1={yFor(70)}
        y2={yFor(70)}
        stroke="currentColor"
        className="text-success"
        strokeOpacity={0.35}
        strokeDasharray="4 4"
      />
      <text
        x={padX + innerW - 4}
        y={yFor(70) - 4}
        textAnchor="end"
        className="fill-success"
        fontSize="10"
        opacity={0.7}
      >
        pass line
      </text>
      <path d={area} fill="url(#trendGrad)" />
      <path
        d={line}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={padX + (values.length - 1) * stepX}
        cy={yFor(values[values.length - 1])}
        r={4}
        fill="hsl(var(--primary))"
      />
    </svg>
  );
}

/* ===================================================================== */
/*  SPEED                                                                 */
/* ===================================================================== */

function SpeedCard({
  stats,
  durationMs,
}: {
  stats: PracticeStats;
  durationMs: number;
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Pace &amp; focus</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SpeedStat label="Total time" value={formatMs(durationMs)} sub="wall clock for this run" />
          <SpeedStat
            label="Avg per question"
            value={formatMs(stats.avg_time_ms)}
            sub="across all primary attempts"
          />
          <SpeedStat
            label="Fastest correct"
            value={
              stats.fastest_correct_ms != null
                ? formatMs(stats.fastest_correct_ms)
                : "—"
            }
            sub="quickest first-try win"
          />
          <SpeedStat
            label="Slowest"
            value={stats.slowest_ms != null ? formatMs(stats.slowest_ms) : "—"}
            sub="longest you sat with one"
          />
        </div>
        <div className="rounded-2xl border border-border bg-elevated/40 p-3 text-xs text-ink-muted flex items-start gap-2">
          <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-primary" />
          <span>
            Practice questions share a 2-minute budget with the coach chat —
            anything close to 2:00 likely involved a Socratic conversation
            rather than just reading.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SpeedStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-border p-3">
      <div className="text-[11px] uppercase tracking-widest text-ink-muted">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl font-semibold tabular-nums text-ink leading-none">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-ink-muted">{sub}</div>
    </div>
  );
}

/* ===================================================================== */
/*  RECOVERY (sibling)                                                    */
/* ===================================================================== */

function RecoveryCard({ stats }: { stats: PracticeStats }) {
  const pct = stats.recovery_pct;
  const tone =
    pct >= 70 ? "bg-success" : pct >= 40 ? "bg-warn" : "bg-danger";
  const has = stats.sibling_attempts > 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Second-chance recovery</h3>
        </div>

        <div className="flex items-end gap-4">
          <div>
            <div className="font-serif text-5xl font-semibold tabular-nums text-ink leading-none">
              {pct}
              <span className="text-xl text-ink-muted">%</span>
            </div>
            <div className="text-[11px] uppercase tracking-widest text-ink-muted mt-2">
              recovery
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="text-sm text-ink">
              {has ? (
                <>
                  <span className="font-medium">{stats.sibling_recovered}</span>{" "}
                  of {stats.sibling_attempts} missed primaries were recovered on
                  the AI follow-up.
                </>
              ) : (
                <>No misses this run — no sibling questions were served.</>
              )}
            </div>
            {has && (
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={cn("h-full", tone)}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <MiniStat label="Hints used" value={stats.hint_count} />
          <MiniStat label="Coached" value={stats.coached_count} />
          <MiniStat
            label="Hard misses"
            value={stats.hard}
            tone={stats.hard > 0 ? "danger" : "muted"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-2.5 text-center",
        tone === "danger"
          ? "border-danger/25 bg-danger/5"
          : "border-border bg-elevated/40",
      )}
    >
      <div
        className={cn(
          "font-serif text-xl font-semibold tabular-nums leading-none",
          tone === "danger" ? "text-danger" : "text-ink",
        )}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-ink-muted mt-1">
        {label}
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  SECTION BREAKDOWN (richer than the assessment one)                    */
/* ===================================================================== */

function SectionBreakdown({
  stats,
  baseline,
  sectionTitles,
}: {
  stats: PracticeStats;
  baseline: PracticeBaseline;
  sectionTitles: Record<string, string>;
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Section breakdown</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {stats.bySection.map((s) => {
            const title = sectionTitles[s.code] ?? "";
            const b = baseline.bySection[s.code];
            const delta = b?.accuracy != null ? s.accuracy - b.accuracy : null;
            const tone =
              s.accuracy >= 80
                ? "bg-success"
                : s.accuracy >= 60
                  ? "bg-warn"
                  : "bg-danger";
            return (
              <div
                key={s.code}
                className="rounded-2xl border border-border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {s.code}
                      </Badge>
                      <span className="text-sm font-medium text-ink truncate">
                        {title}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">
                      {s.correct}/{s.total} first try
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-xl font-semibold tabular-nums text-ink">
                      {s.accuracy}%
                    </div>
                    {delta != null && delta !== 0 && (
                      <div
                        className={cn(
                          "text-[11px] font-medium tabular-nums",
                          delta > 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} pts
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={cn("h-full", tone)}
                    initial={{ width: 0 }}
                    animate={{ width: `${s.accuracy}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ===================================================================== */
/*  QUESTION REVIEW                                                       */
/* ===================================================================== */

function QuestionReview({ review }: { review: PracticeReviewItem[] }) {
  const [filter, setFilter] = React.useState<"all" | "missed" | "coached">("all");
  const filtered = React.useMemo(() => {
    if (filter === "missed") return review.filter((r) => !r.is_correct);
    if (filter === "coached") return review.filter((r) => r.coached);
    return review;
  }, [review, filter]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold">Question review</h3>
          <div className="inline-flex rounded-full border border-border bg-elevated/40 p-0.5 text-xs">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All ({review.length})
            </FilterChip>
            <FilterChip
              active={filter === "missed"}
              onClick={() => setFilter("missed")}
            >
              Missed ({review.filter((r) => !r.is_correct).length})
            </FilterChip>
            <FilterChip
              active={filter === "coached"}
              onClick={() => setFilter("coached")}
            >
              Coached ({review.filter((r) => r.coached).length})
            </FilterChip>
          </div>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing in this filter.</p>
          ) : (
            filtered.map((r) => <ReviewRow key={r.question.id + r.index} item={r} />)
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full transition-colors",
        active
          ? "bg-surface text-ink shadow-soft"
          : "text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ReviewRow({ item }: { item: PracticeReviewItem }) {
  const { open } = useChatSheet();
  const [openRow, setOpenRow] = React.useState(false);
  const q = item.question;
  const map: Record<string, string> = {
    A: q.option_a,
    B: q.option_b,
    C: q.option_c,
    D: q.option_d,
  };
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-elevated transition-colors"
        onClick={() => setOpenRow((v) => !v)}
      >
        <div
          className={cn(
            "h-8 w-8 rounded-full grid place-items-center shrink-0",
            item.is_correct
              ? "bg-success/15 text-success"
              : "bg-danger/15 text-danger",
          )}
        >
          {item.is_correct ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-muted flex items-center gap-2 flex-wrap">
            <span>Q{item.index + 1}</span>
            <Badge variant="outline" className="text-[10px]">
              {q.section_code}
            </Badge>
            <span className="capitalize">· {q.level}</span>
            {item.coached && (
              <span className="inline-flex items-center gap-1 text-primary">
                <GraduationCap className="h-3 w-3" /> coached
              </span>
            )}
            {item.hinted && (
              <span className="inline-flex items-center gap-1 text-warn">
                <Lightbulb className="h-3 w-3" /> hint
              </span>
            )}
          </div>
          <div className="text-sm text-ink truncate mt-0.5">{q.prompt}</div>
        </div>
        {openRow ? (
          <ChevronUp className="h-4 w-4 text-ink-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-ink-muted" />
        )}
      </button>
      {openRow && (
        <div className="p-4 border-t border-border bg-elevated/40 space-y-3 text-sm">
          <div>
            <span className="text-ink-muted">Your answer: </span>
            <span
              className={cn(
                "font-medium",
                item.is_correct ? "text-success" : "text-danger",
              )}
            >
              {item.user_answer
                ? `${item.user_answer}. ${map[item.user_answer]}`
                : "Not answered"}
            </span>
          </div>
          {!item.is_correct && (
            <div>
              <span className="text-ink-muted">Correct: </span>
              <span className="font-medium text-ink">
                {q.correct_option}. {map[q.correct_option]}
              </span>
            </div>
          )}
          {q.explanation && (
            <p className="text-ink-muted leading-relaxed">{q.explanation}</p>
          )}
          <Button
            size="sm"
            variant="soft"
            onClick={() =>
              open({
                id: q.id,
                section_code: q.section_code,
                prompt: q.prompt,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                correct_option: q.correct_option,
                hint: q.hint,
                explanation: q.explanation,
                user_answer: item.user_answer,
              })
            }
          >
            <Sparkles className="h-3.5 w-3.5" /> Ask AI about this question
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── Download PDF Button ─── */
function DownloadPdfButton({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = React.useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/report/practice/${sessionId}/pdf`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `practice-report-${sessionId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast.error("Could not generate PDF. Please try again.");
      console.error("[Practice PDF download]", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      disabled={loading}
      className="gap-1.5"
    >
      <Download className="h-4 w-4" />
      {loading ? "Generating…" : "Download PDF"}
    </Button>
  );
}

/* ===================================================================== */
/*  Unused but reserved (silences lint when feature flagged off)         */
/* ===================================================================== */
void ArrowRight;
