"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Lock,
  TrendingUp,
  BookOpen,
  GraduationCap,
  Flag,
  Target,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatMs } from "@/lib/utils";
import type {
  AssessmentSummary,
  ConceptStat,
  RawAttempt,
} from "@/lib/assessment/summary";
import { useChatSheet } from "@/components/chat/chat-sheet-provider";

// SC salesperson exam pass line.
const PASS_THRESHOLD = 70;

type Tone = "success" | "warn-strong" | "warn-soft" | "danger";

const LABELS = {
  mastered: "Locked in",
  soft_miss: "Recovered",
  hard_miss: "Needs review",
} as const;

const TONES: Record<Tone, { text: string; bg: string; ring: string; soft: string }> = {
  success: {
    text: "text-success",
    bg: "bg-success/10",
    ring: "border-success/25",
    soft: "bg-success",
  },
  "warn-strong": {
    text: "text-warn",
    bg: "bg-warn/10",
    ring: "border-warn/25",
    soft: "bg-warn",
  },
  "warn-soft": {
    text: "text-warn",
    bg: "bg-warn/5",
    ring: "border-warn/15",
    soft: "bg-warn/40",
  },
  danger: {
    text: "text-danger",
    bg: "bg-danger/10",
    ring: "border-danger/25",
    soft: "bg-danger",
  },
};

type Coverage = {
  covered: string[];
  missing: string[];
  allCovered: boolean;
  nextSection: string | null;
};

type Props = {
  sessionId: string;
  durationMs: number;
  summary: AssessmentSummary;
  tutorLetter: string | null;
  conceptTitles: Record<string, string>;
  sectionTitles: Record<string, string>;
  attempts: RawAttempt[];
  lengthLabel: "quick" | "deep" | "smoke" | null;
  coverage: Coverage;
};

export function AssessmentReport({
  sessionId,
  durationMs,
  summary,
  tutorLetter,
  conceptTitles,
  sectionTitles,
  attempts,
  lengthLabel,
  coverage,
}: Props) {
  void sessionId;
  const strict = summary.accuracy_pct;
  const reach = summary.effective_pct;
  const lengthText =
    lengthLabel === "deep"
      ? "Deep diagnostic"
      : lengthLabel === "smoke"
        ? "Smoke test"
        : lengthLabel === "quick"
          ? "Quick check"
          : null;

  const nextSection = coverage.nextSection;
  const nextTitle = nextSection
    ? sectionTitles[nextSection] ?? ""
    : "";
  const continueHref = coverage.missing.length
    ? `/assessment?sections=${coverage.missing.join(",")}`
    : "/assessment";
  const primaryCtaHref = coverage.allCovered ? "/practice" : continueHref;
  const primaryCtaLabel = coverage.allCovered
    ? "Start practice"
    : nextSection
      ? `Continue with ${nextSection}`
      : "Continue assessment";

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 md:p-8 shadow-soft">
        <div className="absolute inset-0 mesh-gradient opacity-20" aria-hidden />
        <div className="relative">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">Assessment results</Badge>
                {lengthText && (
                  <Badge variant="outline" className="text-ink-muted">
                    {lengthText}
                  </Badge>
                )}
              </div>
              <h1 className="mt-3 font-serif text-3xl md:text-4xl font-semibold tracking-tight">
                Your diagnostic snapshot
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                {summary.total} question{summary.total === 1 ? "" : "s"} ·{" "}
                {formatMs(durationMs)} · SC pass line is {PASS_THRESHOLD}%
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button asChild>
                <Link href={primaryCtaHref}>
                  <ArrowRight className="h-4 w-4" /> {primaryCtaLabel}
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/assessment">
                  <RotateCcw className="h-4 w-4" /> Retake
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
            <CompositionRing summary={summary} />
            <div className="grid sm:grid-cols-2 gap-3">
              <MetricBlock
                icon={Target}
                title="First-try mastery"
                caption="No hint, no retry — pure recall."
                value={strict}
                threshold={PASS_THRESHOLD}
                emphasis
              />
              <MetricBlock
                icon={Gauge}
                title="With support"
                caption="Right after a hint or on the second try."
                value={reach}
                threshold={PASS_THRESHOLD}
              />
            </div>
          </div>

          <ExamReadinessBar strict={strict} reach={reach} />

          <CoverageNotice
            coverage={coverage}
            continueHref={continueHref}
            nextSection={nextSection}
            nextTitle={nextTitle}
          />
        </div>
      </section>

      {/* OUTCOME TILES */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatTile
          icon={Lock}
          label={LABELS.mastered}
          sub="First try, no help needed."
          value={summary.mastered}
          total={summary.total}
          tone="success"
        />
        <StatTile
          icon={TrendingUp}
          label={LABELS.soft_miss}
          sub="Right after the hint / retry."
          value={summary.soft_miss}
          total={summary.total}
          tone="warn-strong"
        />
        <StatTile
          icon={BookOpen}
          label={LABELS.hard_miss}
          sub="Missed both tries."
          value={summary.hard_miss}
          total={summary.total}
          tone="danger"
        />
      </section>

      {/* TUTOR LETTER */}
      {tutorLetter && (
        <TutorLetter
          text={tutorLetter}
          primaryHref={primaryCtaHref}
          primaryLabel={
            coverage.allCovered ? "Practice weak topics" : primaryCtaLabel
          }
        />
      )}

      {/* SECTION BREAKDOWN */}
      <SectionBreakdown summary={summary} sectionTitles={sectionTitles} />

      {/* PRIORITIES */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <h3 className="font-semibold">Top to drill next</h3>
              </div>
              {coverage.allCovered ? (
                <Button asChild size="sm" variant="soft">
                  <Link href="/practice">Practice these</Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="soft">
                  <Link href={continueHref}>
                    {nextSection ? `Continue with ${nextSection}` : "Continue assessment"}
                  </Link>
                </Button>
              )}
            </div>
            {summary.weakest_concepts.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nothing flagged — clean run. Push into Mock Exam when
                you&apos;re ready.
              </p>
            ) : (
              <ol className="space-y-2 text-sm">
                {summary.weakest_concepts.map((c, i) => (
                  <ConceptRow
                    key={c.concept_id}
                    rank={i + 1}
                    concept={c}
                    title={conceptTitles[c.concept_id]}
                    tone="weak"
                  />
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-success" />
              <h3 className="font-semibold">Already strong</h3>
            </div>
            {summary.strongest_concepts.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nothing locked in yet — Practice mode will get you there.
              </p>
            ) : (
              <ol className="space-y-2 text-sm">
                {summary.strongest_concepts.map((c, i) => (
                  <ConceptRow
                    key={c.concept_id}
                    rank={i + 1}
                    concept={c}
                    title={conceptTitles[c.concept_id]}
                    tone="strong"
                  />
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QUESTION REVIEW */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Review every question</h3>
          <ReviewList attempts={attempts} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Hero helpers ---------------- */

function CoverageNotice({
  coverage,
  continueHref,
  nextSection,
  nextTitle,
}: {
  coverage: Coverage;
  continueHref: string;
  nextSection: string | null;
  nextTitle: string;
}) {
  const total = coverage.covered.length + coverage.missing.length;
  const done = coverage.covered.length;
  const pct = total ? Math.round((100 * done) / total) : 0;

  if (coverage.allCovered) {
    return (
      <div className="mt-5 rounded-2xl border border-success/30 bg-success/5 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="font-medium text-ink">
            All 12 sections assessed — Practice is unlocked.
          </span>
        </div>
        <Button asChild size="sm">
          <Link href="/practice">
            <ArrowRight className="h-3.5 w-3.5" /> Start practice
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-border bg-elevated/60 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <Lock className="h-4 w-4 text-ink-muted" />
          <span className="font-medium text-ink">
            Practice unlocks at 12/12 sections
          </span>
          <span className="text-ink-muted">· {done}/{total} done</span>
        </div>
        {nextSection && (
          <Button asChild size="sm" variant="outline">
            <Link href={continueHref}>
              Continue with {nextSection}
              {nextTitle ? `: ${nextTitle}` : ""}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CompositionRing({ summary }: { summary: AssessmentSummary }) {
  const size = 176;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const total = summary.total || 1;
  const pct = (n: number) => (100 * n) / total;

  const segs = [
    { value: pct(summary.mastered), cls: "text-success", opacity: 1 },
    { value: pct(summary.soft_miss), cls: "text-warn", opacity: 0.9 },
    { value: pct(summary.hard_miss), cls: "text-danger", opacity: 1 },
  ];

  let offset = 0;
  const center = size / 2;

  return (
    <div className="relative h-[176px] w-[176px] shrink-0 mx-auto">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Track */}
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
            <circle
              key={i}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              pathLength={100}
              strokeWidth={stroke}
              stroke="currentColor"
              strokeOpacity={s.opacity}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              strokeLinecap="butt"
              className={s.cls}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="text-center">
          <div className="font-serif text-4xl font-semibold tabular-nums text-ink leading-none">
            {summary.accuracy_pct}
            <span className="text-xl text-ink-muted">%</span>
          </div>
          <div className="text-[11px] uppercase tracking-wide text-ink-muted mt-1.5">
            first-try
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBlock({
  icon: Icon,
  title,
  caption,
  value,
  threshold,
  emphasis,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  caption: string;
  value: number;
  threshold: number;
  emphasis?: boolean;
}) {
  const passed = value >= threshold;
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        emphasis ? "border-primary/30 bg-primary-soft/30" : "border-border bg-surface",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-7 w-7 rounded-lg grid place-items-center shrink-0",
            emphasis ? "bg-primary/15 text-primary" : "bg-muted text-ink-muted",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-ink">{title}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-serif text-4xl font-semibold tabular-nums text-ink leading-none">
          {value}
          <span className="text-xl text-ink-muted">%</span>
        </span>
        <span
          className={cn(
            "text-xs font-medium",
            passed ? "text-success" : "text-ink-muted",
          )}
        >
          {passed ? "above pass line" : `${Math.max(threshold - value, 0)}% to pass`}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-ink-muted leading-snug">{caption}</p>
    </div>
  );
}

function ExamReadinessBar({ strict, reach }: { strict: number; reach: number }) {
  return (
    <div className="mt-6 pt-5 border-t border-border/60 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-ink-muted" />
          <span className="text-sm font-medium">Exam readiness</span>
        </div>
        <span className="text-xs text-ink-muted">
          SC pass line · {PASS_THRESHOLD}%
        </span>
      </div>
      <MarkerBar label="First-try" pct={strict} color="bg-primary" />
      <MarkerBar label="With support" pct={reach} color="bg-success/60" />
    </div>
  );
}

function MarkerBar({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  const passed = pct >= PASS_THRESHOLD;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <span className="text-ink-muted">{label}</span>
        <span
          className={cn(
            "font-medium tabular-nums",
            passed ? "text-success" : "text-ink",
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-ink/60"
          style={{ left: `${PASS_THRESHOLD}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

/* ---------------- Stat tiles ---------------- */

function StatTile({
  icon: Icon,
  label,
  sub,
  value,
  total,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  value: number;
  total: number;
  tone: Tone;
}) {
  const t = TONES[tone];
  const pct = total ? Math.round((100 * value) / total) : 0;
  return (
    <div className={cn("rounded-2xl border p-4", t.ring, t.bg)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-7 w-7 rounded-lg grid place-items-center", t.text, "bg-surface/60")}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-ink">{label}</span>
        </div>
        <Badge variant="outline" className="text-xs tabular-nums">
          {pct}%
        </Badge>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={cn("font-serif text-3xl font-semibold tabular-nums", t.text)}>
          {value}
        </span>
        <span className="text-xs text-ink-muted">of {total}</span>
      </div>
      <div className="mt-1 text-xs text-ink-muted leading-snug">{sub}</div>
    </div>
  );
}

/* ---------------- Tutor letter ---------------- */

function TutorLetter({
  text,
  primaryHref,
  primaryLabel,
}: {
  text: string;
  primaryHref: string;
  primaryLabel: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-surface to-surface p-6 md:p-8 shadow-soft">
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="relative flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 grid place-items-center shadow-soft">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-success border-2 border-surface" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-ink">Your AI tutor</span>
            <span className="text-xs text-ink-muted">
              Personalized for this run
            </span>
          </div>
          <div className="mt-3 relative rounded-2xl border border-border bg-surface p-4 md:p-5 text-sm leading-relaxed text-ink whitespace-pre-wrap">
            {text}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={primaryHref}>
                <ArrowRight className="h-3.5 w-3.5" /> {primaryLabel}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/mistakes">
                <RotateCcw className="h-3.5 w-3.5" /> Retry missed questions
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Section breakdown ---------------- */

function SectionBreakdown({
  summary,
  sectionTitles,
}: {
  summary: AssessmentSummary;
  sectionTitles: Record<string, string>;
}) {
  const national = summary.sections.filter((s) => s.code.startsWith("A"));
  const state = summary.sections.filter((s) => s.code.startsWith("B"));

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-5">
          <Flag className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Section performance</h3>
          <span className="text-xs text-ink-muted ml-2">
            First-try vs with-support, per section.
          </span>
        </div>
        <div className="grid lg:grid-cols-2 gap-x-6 gap-y-5">
          <SectionGroup
            title="National"
            rows={national}
            titles={sectionTitles}
          />
          <SectionGroup
            title="South Carolina"
            rows={state}
            titles={sectionTitles}
          />
        </div>
        <Legend />
      </CardContent>
    </Card>
  );
}

function SectionGroup({
  title,
  rows,
  titles,
}: {
  title: string;
  rows: AssessmentSummary["sections"];
  titles: Record<string, string>;
}) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="text-[11px] font-medium text-ink-muted mb-3 uppercase tracking-wider">
        {title}
      </div>
      <div className="space-y-2.5">
        {rows.map((s) => (
          <SectionRow key={s.code} row={s} title={titles[s.code]} />
        ))}
      </div>
    </div>
  );
}

function SectionRow({
  row,
  title,
}: {
  row: AssessmentSummary["sections"][number];
  title?: string;
}) {
  const s = row;
  const reach = s.total
    ? Math.round((100 * (s.mastered + s.soft_miss)) / s.total)
    : 0;
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="shrink-0">
            {s.code}
          </Badge>
          <span className="text-sm font-medium text-ink truncate">
            {title ?? s.code}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <span className="text-ink-muted">
            <span className="font-medium text-ink tabular-nums">
              {s.accuracy}%
            </span>{" "}
            first-try
          </span>
          <span className="text-ink-muted">
            <span className="font-medium text-ink tabular-nums">{reach}%</span>{" "}
            reach
          </span>
        </div>
      </div>
      <div className="mt-2 h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
        <Bar n={s.mastered} total={s.total} color="bg-success" />
        <Bar n={s.soft_miss} total={s.total} color="bg-warn" />
        <Bar n={s.hard_miss} total={s.total} color="bg-danger" />
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-5 flex items-center gap-4 flex-wrap text-xs text-ink-muted">
      <LegendDot color="bg-success" label={LABELS.mastered} />
      <LegendDot color="bg-warn" label={LABELS.soft_miss} />
      <LegendDot color="bg-danger" label={LABELS.hard_miss} />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      {label}
    </span>
  );
}

function Bar({
  n,
  total,
  color,
}: {
  n: number;
  total: number;
  color: string;
}) {
  if (!total || !n) return null;
  const w = Math.max(2, (n / total) * 100);
  return <div className={cn("h-full", color)} style={{ width: `${w}%` }} />;
}

/* ---------------- Concept rows ---------------- */

function ConceptRow({
  rank,
  concept,
  title,
  tone,
}: {
  rank: number;
  concept: ConceptStat;
  title?: string;
  tone: "weak" | "strong";
}) {
  const niceTitle =
    title ??
    concept.concept_id
      .split(".")
      .slice(1)
      .join(" ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "h-7 w-7 rounded-full grid place-items-center text-xs font-semibold",
            tone === "weak"
              ? "bg-danger/15 text-danger"
              : "bg-success/15 text-success",
          )}
        >
          {rank}
        </span>
        <div className="min-w-0">
          <div className="font-medium text-ink truncate">{niceTitle}</div>
          <div className="text-xs text-ink-muted truncate">
            {concept.section_code} · {concept.mastered}/{concept.total} clean
            {concept.hard_miss > 0 && ` · ${concept.hard_miss} missed twice`}
            {concept.soft_miss > 0 && ` · ${concept.soft_miss} recovered`}
          </div>
        </div>
      </div>
      <Badge
        variant={tone === "weak" ? "danger" : "success"}
        className="shrink-0 tabular-nums"
      >
        {concept.accuracy}%
      </Badge>
    </li>
  );
}

/* ---------------- Review list ---------------- */

function ReviewList({ attempts }: { attempts: RawAttempt[] }) {
  const byQ = new Map<string, RawAttempt>();
  for (const a of attempts) {
    if (!a.result_label) continue;
    byQ.set(a.question_id, a);
  }
  const rows = Array.from(byQ.values());
  return (
    <div className="space-y-2">
      {rows.map((a, i) => (
        <ReviewRow key={a.question_id} index={i} attempt={a} />
      ))}
    </div>
  );
}

function ReviewRow({
  index,
  attempt,
}: {
  index: number;
  attempt: RawAttempt;
}) {
  const [open, setOpen] = React.useState(false);
  const { open: openChat } = useChatSheet();
  const q = attempt.question;
  const map: Record<string, string> = {
    A: q.option_a,
    B: q.option_b,
    C: q.option_c,
    D: q.option_d,
  };
  const label = attempt.result_label;
  const Icon =
    label === "mastered"
      ? CheckCircle2
      : label === "soft_miss"
        ? AlertTriangle
        : XCircle;
  const iconTone =
    label === "mastered"
      ? "text-success bg-success/15"
      : label === "soft_miss"
        ? "text-warn bg-warn/15"
        : "text-danger bg-danger/15";

  const friendlyLabel =
    label === "mastered"
      ? LABELS.mastered
      : label === "soft_miss"
        ? LABELS.soft_miss
        : label === "hard_miss"
          ? LABELS.hard_miss
          : "";

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-elevated transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div
          className={cn(
            "h-8 w-8 rounded-full grid place-items-center shrink-0",
            iconTone,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-muted">
            Q{index + 1} · {q.section_code} · {friendlyLabel}
          </div>
          <div className="text-sm text-ink truncate">{q.prompt}</div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-ink-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-ink-muted" />
        )}
      </button>
      {open && (
        <div className="p-4 border-t border-border bg-elevated/40 space-y-3 text-sm">
          <div>
            <span className="text-ink-muted">Your final answer: </span>
            <span
              className={cn(
                "font-medium",
                attempt.is_correct ? "text-success" : "text-danger",
              )}
            >
              {attempt.user_answer
                ? `${attempt.user_answer}. ${map[attempt.user_answer]}`
                : "Not answered"}
            </span>
          </div>
          <div>
            <span className="text-ink-muted">Correct: </span>
            <span className="font-medium text-ink">
              {q.correct_option}. {map[q.correct_option]}
            </span>
          </div>
          {q.explanation && (
            <p className="text-ink-muted leading-relaxed">{q.explanation}</p>
          )}
          <Button
            size="sm"
            variant="soft"
            onClick={() =>
              openChat({
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
                user_answer: attempt.user_answer,
              })
            }
          >
            <Sparkles className="h-3.5 w-3.5" /> Ask AI about this
          </Button>
        </div>
      )}
    </div>
  );
}
