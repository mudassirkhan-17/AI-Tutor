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
  Lightbulb,
  Timer,
  Target,
  Gauge,
  AlertTriangle,
  Flame,
  ArrowRight,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { KpiHelpKey } from "@/components/kpi/kpi-help-copy";
import { KpiInsightByKey } from "@/components/kpi/kpi-insight-tooltip";
import { cn, formatMs } from "@/lib/utils";
import { useChatSheet } from "@/components/chat/chat-sheet-provider";
import { toast } from "sonner";
import type { MistakesStats, MistakesReviewItem } from "@/lib/mistakes/results";
import type { Journey } from "@/lib/journey/load";
import { JourneyPanel } from "@/components/results/journey-panel";
import { DebriefPanel } from "@/components/coach/debrief-panel";
import type { DebriefPlan } from "@/lib/coach/debrief-plan";
import { rankSections, enrichSections } from "@/lib/coach/build-snapshot";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";

type Props = {
  sessionId: string;
  durationMs: number;
  stats: MistakesStats;
  journey: Journey;
  aiNote: string;
  initialPlan?: DebriefPlan | null;
  initialPlanCommitted?: boolean;
};

/* =====================================================================
 * MistakesResultsView
 *
 * Mirrors PracticeResultsView's visual language but tailored for the
 * single-shot Mistakes Test: the headline is "recovered vs still
 * leaking" rather than first-try mastery. Includes a cross-mode
 * Journey panel so the student can see this run in context.
 * ===================================================================== */
export function MistakesResultsView({
  sessionId,
  durationMs,
  stats,
  journey,
  aiNote,
  initialPlan,
  initialPlanCommitted,
}: Props) {
  const sectionSnapshot = enrichSections(
    stats.bySection.map((s) => ({
      code: s.code,
      title: formatSectionDisplayLabel(s.code),
      total: s.total,
      correct: s.recovered,
      accuracy: s.accuracy,
      baselineAccuracy: null,
    })),
  );
  const { weakest, strongest } = rankSections(sectionSnapshot);
  const debriefSnapshot = {
    mode: "mistakes" as const,
    sessionId,
    total: stats.total,
    correct: stats.recovered,
    accuracy: stats.accuracy_pct,
    passBar: null,
    durationMs,
    hintUsed: stats.hint_count,
    coachedPct: null,
    bySection: sectionSnapshot,
    weakestCodes: weakest,
    strongestCodes: strongest,
    prior: null,
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
      <JourneyPanel journey={journey} currentSessionId={sessionId} />

      <div className="grid lg:grid-cols-2 gap-4">
        <DifficultyCard stats={stats} />
        <TrendCard stats={stats} />
      </div>

      <SpeedCard stats={stats} durationMs={durationMs} />

      <SectionBreakdown stats={stats} />

      <QuestionReview review={stats.review} />
    </div>
  );
}

/* ===================================================================== */
/*  HERO                                                                  */
/* ===================================================================== */

function Hero({ stats, durationMs, sessionId }: { stats: MistakesStats; durationMs: number; sessionId: string }) {
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
        <RecoveryRing stats={stats} />
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">Mistakes results</Badge>
            <Badge variant="outline" className="text-ink-muted">
              {stats.total} resurfaced
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
              label="Recovered"
              caption="You used to miss these — fixed today."
              value={stats.accuracy_pct}
              tone={
                stats.accuracy_pct >= 70
                  ? "success"
                  : stats.accuracy_pct >= 50
                    ? "warn"
                    : "danger"
              }
              helpKey="mistakes_headline_recovered"
            />
            <HeadlineMetric
              icon={Gauge}
              label="Still leaking"
              caption="Missed again — drill these next."
              value={stats.total ? Math.round((stats.still_leaking / stats.total) * 100) : 0}
              tone={
                stats.still_leaking === 0
                  ? "success"
                  : stats.still_leaking <= 2
                    ? "warn"
                    : "danger"
              }
              helpKey="mistakes_headline_leaking"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
            <Button asChild>
              <Link href="/mistakes">
                <RotateCcw className="h-4 w-4" /> Retake mistakes
              </Link>
            </Button>
            {stats.still_leaking > 0 && (
              <Button asChild variant="soft">
                <Link href="/practice">
                  <Flame className="h-4 w-4" /> Drill in Practice
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

function greet(s: MistakesStats): string {
  if (!s.total) return "Run complete.";
  if (s.accuracy_pct >= 85) return "Big lift — those leaks are sealing up.";
  if (s.accuracy_pct >= 65) return "Real progress on your old miss list.";
  if (s.accuracy_pct >= 45) return "Half-fix — material is in reach but not owned yet.";
  return "Honest read — these are the ones to drill before retesting.";
}

function RecoveryRing({ stats }: { stats: MistakesStats }) {
  const size = 200;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const total = Math.max(1, stats.total);
  const seg = (n: number) => (100 * n) / total;

  const segs = [
    { value: seg(stats.recovered), cls: "text-success" },
    { value: seg(stats.still_leaking), cls: "text-danger" },
  ];

  let offset = 0;
  const center = size / 2;

  return (
    <div className="relative shrink-0 mx-auto" style={{ width: size, height: size }}>
      <KpiInsightByKey k="mistakes_recovery_ring" className="rounded-full h-full w-full">
        <div className="relative h-full w-full">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
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
            {stats.accuracy_pct}
            <span className="text-2xl text-ink-muted">%</span>
          </div>
          <div className="text-[11px] uppercase tracking-widest text-ink-muted mt-2">
            recovered
          </div>
          <div className="mt-3 inline-flex items-center gap-2 text-[11px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-success" />
              {stats.recovered}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-danger" />
              {stats.still_leaking}
            </span>
          </div>
        </div>
      </div>
        </div>
      </KpiInsightByKey>
    </div>
  );
}

function HeadlineMetric({
  icon: Icon,
  label,
  caption,
  value,
  tone,
  helpKey,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  caption: string;
  value: number;
  tone: "success" | "warn" | "danger";
  helpKey: KpiHelpKey;
}) {
  const toneCls =
    tone === "success" ? "text-success" : tone === "warn" ? "text-warn" : "text-danger";
  const trackCls =
    tone === "success" ? "bg-success" : tone === "warn" ? "bg-warn" : "bg-danger";
  return (
    <KpiInsightByKey k={helpKey}>
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
    </KpiInsightByKey>
  );
}

/* ===================================================================== */
/*  KPI GRID                                                              */
/* ===================================================================== */

function KpiGrid({ stats }: { stats: MistakesStats }) {
  const tiles: KpiTileProps[] = [
    {
      icon: CheckCircle2,
      tone: "success",
      label: "Fixed",
      value: stats.recovered,
      sub: `of ${stats.total} resurfaced`,
      helpKey: "mistakes_fixed",
    },
    {
      icon: XCircle,
      tone: "danger",
      label: "Still leaking",
      value: stats.still_leaking,
      sub: `missed again`,
      helpKey: "mistakes_leaking",
    },
    {
      icon: Lightbulb,
      tone: "warn",
      label: "Hint usage",
      value: `${stats.hint_pct}%`,
      sub: `${stats.hint_count} of ${stats.total} needed a hint`,
      helpKey: "mistakes_hints",
    },
    {
      icon: Timer,
      tone: "primary",
      label: "Avg time",
      value: stats.avg_time_ms ? formatMs(stats.avg_time_ms) : "—",
      sub: stats.fastest_correct_ms
        ? `Fastest fix ${formatMs(stats.fastest_correct_ms)}`
        : `No timing data`,
      helpKey: "mistakes_avg_time",
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
  helpKey: KpiHelpKey;
  index?: number;
};

function KpiTile({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  helpKey,
  index = 0,
}: KpiTileProps) {
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
      className="h-full"
    >
      <KpiInsightByKey k={helpKey} className="h-full">
      <Card className="h-full">
        <CardContent className="p-4 flex flex-col gap-2">
          <div className={cn("h-9 w-9 grid place-items-center rounded-xl border", toneCls)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="font-serif text-3xl font-semibold tabular-nums text-ink leading-none">
            {value}
          </div>
          <div className="text-xs uppercase tracking-widest text-ink-muted">{label}</div>
          <div className="text-[11px] text-ink-muted leading-snug">{sub}</div>
        </CardContent>
      </Card>
      </KpiInsightByKey>
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
            <p className="text-[11px] text-ink-muted">
              Personal read on your recovery — no answers, just the why.
            </p>
          </div>
        </div>
        <div className="text-sm text-ink leading-relaxed whitespace-pre-line">{note}</div>
      </CardContent>
    </Card>
  );
}

/* ===================================================================== */
/*  DIFFICULTY                                                            */
/* ===================================================================== */

function DifficultyCard({ stats }: { stats: MistakesStats }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Difficulty mix</h3>
        </div>
        <div className="space-y-3">
          {stats.byDifficulty.map((d) => {
            const tone =
              d.accuracy >= 70
                ? { bar: "bg-success", text: "text-success" }
                : d.accuracy >= 50
                  ? { bar: "bg-warn", text: "text-warn" }
                  : { bar: "bg-danger", text: "text-danger" };
            return (
              <div key={d.level}>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {d.level}
                    </Badge>
                    <span className="text-ink-muted text-xs">
                      {d.recovered}/{d.total}
                    </span>
                  </div>
                  <span className={cn("font-medium tabular-nums", tone.text)}>
                    {d.accuracy}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={cn("h-full", tone.bar)}
                    initial={{ width: 0 }}
                    animate={{ width: `${d.accuracy}%` }}
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
/*  TREND                                                                 */
/* ===================================================================== */

function TrendCard({ stats }: { stats: MistakesStats }) {
  const points = stats.trend;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Run rhythm</h3>
          <span className="ml-auto text-[11px] text-ink-muted">
            Rolling 5-Q accuracy
          </span>
        </div>
        {points.length < 2 ? (
          <p className="text-sm text-ink-muted">Need at least 2 attempts to chart this.</p>
        ) : (
          <Sparkline values={points} />
        )}
      </CardContent>
    </Card>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 600;
  const h = 90;
  const padX = 6;
  const padY = 12;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;
  const yFor = (v: number) => padY + (1 - v / 100) * innerH;
  const xFor = (i: number) => padX + i * stepX;
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`)
    .join(" ");
  const area = `${path} L ${xFor(values.length - 1).toFixed(1)} ${h - padY} L ${xFor(0).toFixed(1)} ${h - padY} Z`;
  const last = values[values.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-[100px]">
        <path d={area} className="fill-primary/15" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-primary" />
        {values.map((v, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(v)}
            r={i === values.length - 1 ? 3 : 1.6}
            className="fill-primary"
          />
        ))}
        <line
          x1={padX}
          x2={w - padX}
          y1={yFor(70)}
          y2={yFor(70)}
          className="stroke-success/60"
          strokeWidth={0.7}
          strokeDasharray="3 3"
        />
      </svg>
      <div className="mt-1 text-[11px] text-ink-muted flex items-center justify-between">
        <span>Start of run</span>
        <span>
          End:{" "}
          <span
            className={cn(
              "font-medium",
              last >= 70 ? "text-success" : last >= 50 ? "text-warn" : "text-danger",
            )}
          >
            {last}%
          </span>
        </span>
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  SPEED                                                                 */
/* ===================================================================== */

function SpeedCard({
  stats,
  durationMs,
}: {
  stats: MistakesStats;
  durationMs: number;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Timer className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Pace</h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <SpeedTile
            label="Total"
            value={formatMs(durationMs || stats.total_time_ms)}
            sub={`${stats.total} questions`}
          />
          <SpeedTile
            label="Avg / question"
            value={stats.avg_time_ms ? formatMs(stats.avg_time_ms) : "—"}
            sub={`Aim for under 60s on the real exam`}
          />
          <SpeedTile
            label="Slowest"
            value={stats.slowest_ms ? formatMs(stats.slowest_ms) : "—"}
            sub={
              stats.fastest_correct_ms
                ? `Fastest fix ${formatMs(stats.fastest_correct_ms)}`
                : "No fix data"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SpeedTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[11px] uppercase tracking-widest text-ink-muted">{label}</div>
      <div className="font-serif text-2xl font-semibold tabular-nums text-ink mt-1">
        {value}
      </div>
      <p className="text-[11px] text-ink-muted mt-1">{sub}</p>
    </div>
  );
}

/* ===================================================================== */
/*  SECTION BREAKDOWN                                                     */
/* ===================================================================== */

function SectionBreakdown({
  stats,
}: {
  stats: MistakesStats;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Section recovery</h3>
          <span className="ml-auto text-[11px] text-ink-muted">
            Worst → best
          </span>
        </div>
        <div className="space-y-2">
          {stats.bySection.map((s) => {
            const tone =
              s.accuracy >= 70
                ? { bar: "bg-success", text: "text-success", icon: CheckCircle2, cls: "text-success" }
                : s.accuracy >= 50
                  ? { bar: "bg-warn", text: "text-warn", icon: AlertTriangle, cls: "text-warn" }
                  : { bar: "bg-danger", text: "text-danger", icon: XCircle, cls: "text-danger" };
            const Icon = tone.icon;
            return (
              <div key={s.code} className="rounded-xl border border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <Icon className={cn("h-4 w-4 shrink-0", tone.cls)} />
                  <Badge variant="outline" className="text-left whitespace-normal font-normal leading-snug max-w-[min(100%,22rem)]">
                    {formatSectionDisplayLabel(s.code)}
                  </Badge>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-sm text-ink-muted tabular-nums">
                      {s.recovered}/{s.total}
                    </span>
                    <span className={cn("font-medium w-10 text-right tabular-nums", tone.text)}>
                      {s.accuracy}%
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={cn("h-full", tone.bar)}
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
/*  REVIEW                                                                */
/* ===================================================================== */

function QuestionReview({
  review,
}: {
  review: MistakesReviewItem[];
}) {
  type Filter = "all" | "leaking" | "fixed";
  const [filter, setFilter] = React.useState<Filter>("all");

  const filtered = React.useMemo(() => {
    if (filter === "leaking") return review.filter((r) => !r.is_correct);
    if (filter === "fixed") return review.filter((r) => r.is_correct);
    return review;
  }, [review, filter]);

  const counts = {
    all: review.length,
    leaking: review.filter((r) => !r.is_correct).length,
    fixed: review.filter((r) => r.is_correct).length,
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <h3 className="font-semibold">Question review</h3>
          <div className="ml-auto inline-flex rounded-lg border border-border p-0.5 text-xs">
            {(["all", "leaking", "fixed"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-md capitalize transition-colors",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {f} ({counts[f]})
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-6">
              Nothing here.
            </p>
          ) : (
            filtered.map((r) => (
              <ReviewRow key={r.question.id + r.index} item={r} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewRow({
  item,
}: {
  item: MistakesReviewItem;
}) {
  const { open } = useChatSheet();
  const [expanded, setExpanded] = React.useState(false);
  const { question: q, user_answer, is_correct, hinted, time_spent_ms } = item;
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
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          className={cn(
            "h-8 w-8 rounded-full grid place-items-center shrink-0",
            is_correct ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
          )}
        >
          {is_correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-muted flex items-center gap-2 flex-wrap">
            <span>
              Q{item.index + 1} · {formatSectionDisplayLabel(q.section_code)}
            </span>
            <span className="capitalize">· {q.level}</span>
            {hinted && (
              <span className="inline-flex items-center gap-1 text-warn">
                <Lightbulb className="h-3 w-3" />
                hint
              </span>
            )}
            {time_spent_ms > 0 && (
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {formatMs(time_spent_ms)}
              </span>
            )}
          </div>
          <div className="text-sm text-ink truncate">{q.prompt}</div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-ink-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-ink-muted" />
        )}
      </button>
      {expanded && (
        <div className="p-4 border-t border-border bg-elevated/40 space-y-3 text-sm">
          <div>
            <span className="text-ink-muted">Your answer: </span>
            <span
              className={cn("font-medium", is_correct ? "text-success" : "text-danger")}
            >
              {user_answer ? `${user_answer}. ${map[user_answer]}` : "Not answered"}
            </span>
          </div>
          {!is_correct && (
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
          <div className="flex flex-wrap gap-2">
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
                  user_answer,
                })
              }
            >
              <Sparkles className="h-3.5 w-3.5" /> Ask AI about this question
            </Button>
            {!is_correct && (
              <Button asChild size="sm" variant="ghost">
                <Link href="/practice">
                  Drill in Practice <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
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
      const res = await fetch(`/api/report/mistakes/${sessionId}/pdf`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `mistakes-report-${sessionId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast.error("Could not generate PDF. Please try again.");
      console.error("[Mistakes PDF download]", err);
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
