"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Trophy,
  Sparkles,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Quote,
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

type Props = {
  sessionId: string;
  durationMs: number;
  summary: AssessmentSummary;
  tutorLetter: string | null;
  conceptTitles: Record<string, string>;
  sectionTitles: Record<string, string>;
  attempts: RawAttempt[];
  lengthLabel: "quick" | "deep" | "smoke" | null;
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
}: Props) {
  void sessionId;
  const score = summary.accuracy_pct;
  const effective = summary.effective_pct;

  return (
    <div className="space-y-8">
      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft"
      >
        <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <Badge variant="outline" className="mb-3 capitalize">
              Assessment results
              {lengthLabel
                ? ` · ${
                    lengthLabel === "deep"
                      ? "Deep diagnostic"
                      : lengthLabel === "smoke"
                        ? "Smoke test"
                        : "Quick check"
                  }`
                : ""}
            </Badge>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="font-serif text-7xl md:text-8xl font-semibold tracking-tight text-ink leading-none">
                {score}
                <span className="text-3xl text-ink-muted">%</span>
              </div>
              <div className="mb-3 text-sm text-ink-muted">
                <div>
                  <span className="font-medium text-ink">{summary.mastered}</span>{" "}
                  mastered of {summary.total}
                </div>
                <div>
                  Effective:{" "}
                  <span className="font-medium text-ink">{effective}%</span>{" "}
                  · {formatMs(durationMs)}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild>
              <Link href="/practice">
                <ArrowRight className="h-4 w-4" /> Start practice
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/assessment">
                <RotateCcw className="h-4 w-4" /> Retake
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* STAT TILES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Mastered"
          value={summary.mastered}
          tone="success"
          hint="First try, no hint."
        />
        <StatTile
          label="Lucky"
          value={summary.lucky}
          tone="warn"
          hint="Right with hint — re-test next."
        />
        <StatTile
          label="Soft miss"
          value={summary.soft_miss}
          tone="warn"
          hint="Right on second try — reachable."
        />
        <StatTile
          label="Hard miss"
          value={summary.hard_miss}
          tone="danger"
          hint="Wrong twice — needs teaching."
        />
      </div>

      {/* TUTOR LETTER */}
      {tutorLetter && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-xl bg-primary/15 grid place-items-center">
                <Quote className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="font-semibold">A note from your AI tutor</div>
                <div className="text-xs text-ink-muted">
                  Personalized for this assessment.
                </div>
              </div>
            </div>
            <div className="prose prose-sm max-w-none text-ink leading-relaxed whitespace-pre-wrap">
              {tutorLetter}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION BREAKDOWN */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Section breakdown</h3>
          </div>
          <div className="space-y-2">
            {summary.sections.map((s) => (
              <div
                key={s.code}
                className="rounded-xl border border-border p-3"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline">{s.code}</Badge>
                    <span className="text-sm font-medium text-ink truncate">
                      {sectionTitles[s.code] ?? s.code}
                    </span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {s.accuracy}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden flex">
                  <Bar n={s.mastered} total={s.total} color="bg-success" />
                  <Bar n={s.lucky} total={s.total} color="bg-warn/70" />
                  <Bar n={s.soft_miss} total={s.total} color="bg-warn/40" />
                  <Bar n={s.hard_miss} total={s.total} color="bg-danger" />
                </div>
                <div className="mt-1 text-xs text-ink-muted flex flex-wrap gap-x-3">
                  <span><Dot c="bg-success" /> {s.mastered} mastered</span>
                  <span><Dot c="bg-warn/70" /> {s.lucky} lucky</span>
                  <span><Dot c="bg-warn/40" /> {s.soft_miss} soft</span>
                  <span><Dot c="bg-danger" /> {s.hard_miss} hard</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PRIORITIES */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <h3 className="font-semibold">Top 5 to drill next</h3>
            </div>
            {summary.weakest_concepts.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nothing flagged — clean run. Push into Mock Exam when you&apos;re
                ready.
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

function StatTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "success" | "warn" | "danger";
  hint: string;
}) {
  const toneText =
    tone === "success" ? "text-success" : tone === "warn" ? "text-warn" : "text-danger";
  const toneBg =
    tone === "success" ? "bg-success/10" : tone === "warn" ? "bg-warn/10" : "bg-danger/10";
  return (
    <div className={cn("rounded-2xl border border-border p-4", toneBg)}>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={cn("font-serif text-3xl font-semibold tabular-nums", toneText)}>
        {value}
      </div>
      <div className="text-xs text-ink-muted mt-1 leading-snug">{hint}</div>
    </div>
  );
}

function Bar({ n, total, color }: { n: number; total: number; color: string }) {
  if (!total || !n) return null;
  const w = Math.max(2, (n / total) * 100);
  return <div className={cn("h-full", color)} style={{ width: `${w}%` }} />;
}

function Dot({ c }: { c: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full mr-1 align-middle",
        c,
      )}
    />
  );
}

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
            {concept.hard_miss > 0 && ` · ${concept.hard_miss} hard miss`}
            {concept.soft_miss > 0 && ` · ${concept.soft_miss} soft`}
            {concept.lucky > 0 && ` · ${concept.lucky} lucky`}
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

function ReviewList({ attempts }: { attempts: RawAttempt[] }) {
  // Collapse multiple attempts per question into one row showing the labelled outcome.
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

function ReviewRow({ index, attempt }: { index: number; attempt: RawAttempt }) {
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
      : label === "lucky"
        ? Lightbulb
        : label === "soft_miss"
          ? AlertTriangle
          : XCircle;
  const tone =
    label === "mastered"
      ? "text-success bg-success/15"
      : label === "lucky"
        ? "text-warn bg-warn/15"
        : label === "soft_miss"
          ? "text-warn bg-warn/15"
          : "text-danger bg-danger/15";

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-elevated transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className={cn("h-8 w-8 rounded-full grid place-items-center shrink-0", tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-muted">
            Q{index + 1} · {q.section_code} · {label?.replace("_", " ")}
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
