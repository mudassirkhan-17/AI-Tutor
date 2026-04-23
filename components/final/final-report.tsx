"use client";

import * as React from "react";
import Link from "next/link";
import {
  Trophy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RotateCcw,
  Calendar,
  Compass,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatMs } from "@/lib/utils";
import { useChatSheet } from "@/components/chat/chat-sheet-provider";
import type { QuestionRow } from "@/lib/supabase/types";
import type {
  FinalReport as FinalReportData,
  VerdictTier,
} from "@/lib/final/report";
import { FINAL_PASS_PCT } from "@/lib/final/pick-questions";

export type ReviewAttempt = {
  question: QuestionRow;
  user_answer: "A" | "B" | "C" | "D" | null;
  is_correct: boolean;
};

type Props = {
  sessionId: string;
  durationMs: number;
  passPct: number;
  report: FinalReportData;
  predictedPassProbability: number | null;
  attempts: ReviewAttempt[];
};

function band(p: number, passPct: number) {
  if (p >= 85) return { bar: "bg-success", text: "text-success" };
  if (p >= passPct) return { bar: "bg-success/70", text: "text-success" };
  if (p >= passPct - 5) return { bar: "bg-warn", text: "text-warn" };
  return { bar: "bg-danger", text: "text-danger" };
}

export function FinalReport({
  durationMs,
  passPct,
  report,
  predictedPassProbability,
  attempts,
}: Props) {
  const heroTone = report.passed
    ? "border-success/30 bg-success/5"
    : "border-danger/30 bg-danger/5";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden rounded-3xl border bg-surface p-8 md:p-12 shadow-soft",
          heroTone,
        )}
      >
        <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant="outline">Final Test results</Badge>
              <Badge variant={report.passed ? "success" : "danger"}>
                {report.passed ? "PASSED" : "NOT YET"}
              </Badge>
              <Badge variant="secondary">
                {formatMs(durationMs)} · pass per portion: {passPct}%
              </Badge>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight">
              {heroHeadline(report)}
            </h1>
            <p className="mt-3 text-lg text-ink-muted max-w-2xl">
              The PSI exam scores National and State{" "}
              <span className="font-medium text-ink">independently</span>. You
              must pass each portion on its own — combined % is shown for
              reference only.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild>
              <Link href="/final-test">
                <RotateCcw className="h-4 w-4" />
                Final overview
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Verdict tier */}
      <VerdictCard verdict={report.verdict} report={report} />

      {/* Two portion subscores */}
      <div className="grid gap-4 md:grid-cols-2">
        <PortionCard
          label="National portion"
          subtitle="Sections A1–A6"
          correct={report.nationalCorrect}
          total={report.nationalTotal}
          accuracyPct={report.nationalPct}
          passPct={passPct}
          passed={report.nationalPassed}
          weakest={report.nationalWeakest}
        />
        <PortionCard
          label="South Carolina portion"
          subtitle="Sections B1–B6"
          correct={report.stateCorrect}
          total={report.stateTotal}
          accuracyPct={report.statePct}
          passPct={passPct}
          passed={report.statePassed}
          weakest={report.stateWeakest}
        />
      </div>

      {/* Predicted pass probability */}
      <PassProbCard
        probability={predictedPassProbability}
        report={report}
        passPct={passPct}
      />

      {/* Section breakdown */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Section breakdown</h3>
            <Badge variant="outline" className="ml-auto text-[10px]">
              Pass bar {passPct}% per portion
            </Badge>
          </div>
          <div className="space-y-2">
            {report.sections
              .filter((s) => s.total > 0)
              .map((s) => {
                const b = band(s.accuracyPct, passPct);
                return (
                  <div
                    key={s.code}
                    className="rounded-xl border border-border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline">{s.code}</Badge>
                        <span className="text-sm text-ink truncate max-w-[200px] md:max-w-[320px]">
                          {s.title}
                        </span>
                        <span className="text-xs text-ink-muted shrink-0">
                          ({s.group === "National" ? "Nat." : "SC"})
                        </span>
                      </div>
                      <div className="ml-auto flex items-center gap-3">
                        <span className="text-sm text-ink-muted tabular-nums">
                          {s.correct}/{s.total}
                        </span>
                        <span
                          className={cn(
                            "font-medium w-10 text-right tabular-nums",
                            b.text,
                          )}
                        >
                          {s.accuracyPct}%
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full", b.bar)}
                        style={{ width: `${s.accuracyPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Question review */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Question review</h3>
            <span className="text-xs text-ink-muted ml-auto">
              {attempts.filter((a) => !a.is_correct).length} to revisit
            </span>
          </div>
          <div className="space-y-2">
            {attempts.map((a, i) => (
              <ReviewRow key={a.question.id + i} index={i} attempt={a} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function heroHeadline(r: FinalReportData) {
  if (r.passed) {
    return r.combinedPct >= 85
      ? "Strong pass on both portions."
      : "Both portions cleared.";
  }
  if (r.nationalPassed && !r.statePassed) return "National passed. State did not.";
  if (!r.nationalPassed && r.statePassed) return "State passed. National did not.";
  return "Both portions below the line.";
}

function VerdictCard({
  verdict,
  report,
}: {
  verdict: VerdictTier;
  report: FinalReportData;
}) {
  switch (verdict.kind) {
    case "schedule_real":
      return (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <Row icon={<Trophy className="h-5 w-5 text-success" />}>
              <h3 className="font-semibold mb-1">
                Schedule the real exam.
              </h3>
              <p className="text-sm text-ink-muted">
                You cleared the bar with margin on{" "}
                {verdict.portionsAtOrAbove === 2
                  ? "both portions (≥85%)"
                  : "the portion you ran (≥85%)"}
                . The pattern of misses you have here is normal exam-day
                noise. If you want, do one more Mistakes Test for confidence,
                then book PSI.
              </p>
            </Row>
          </CardContent>
        </Card>
      );

    case "ready_margin":
      return (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <Row icon={<ShieldCheck className="h-5 w-5 text-success" />}>
              <h3 className="font-semibold mb-1">Ready, with margin.</h3>
              <p className="text-sm text-ink-muted">
                Both portions in the 75–84% range. Comfortable pass; nothing
                urgent to fix. A short Mistakes Test in the week before your
                exam date is enough.
              </p>
            </Row>
          </CardContent>
        </Card>
      );

    case "ready_narrow":
      return (
        <Card className="border-warn/30 bg-warn/5">
          <CardContent className="pt-6">
            <Row icon={<Compass className="h-5 w-5 text-warn" />}>
              <h3 className="font-semibold mb-1">Ready — narrow margin.</h3>
              <p className="text-sm text-ink-muted">
                Both portions just over the line (70–74%). You&apos;ll likely
                pass the real exam, but a bad day could flip it. Spend a focused
                week on{" "}
                {topWeakSpots(report)
                  .slice(0, 3)
                  .map((s, i, arr) => (
                    <React.Fragment key={s}>
                      <span className="font-medium text-ink">{s}</span>
                      {i < arr.length - 1 ? (i === arr.length - 2 ? " and " : ", ") : ""}
                    </React.Fragment>
                  ))}{" "}
                before booking.
              </p>
            </Row>
          </CardContent>
        </Card>
      );

    case "partial_pass_close":
      return (
        <Card className="border-warn/30 bg-warn/5">
          <CardContent className="pt-6">
            <Row icon={<Calendar className="h-5 w-5 text-warn" />}>
              <h3 className="font-semibold mb-1">
                {verdict.passed === "national" ? "National" : "SC"} passed,{" "}
                {verdict.passed === "national" ? "State" : "National"} just
                short ({verdict.otherPct}%).
              </h3>
              <p className="text-sm text-ink-muted">
                The real exam lets you retake just the failed portion within 6
                months. After 7 days of cooldown + one Practice + one Mistakes
                Test, your next Final will run only the missing portion.
              </p>
            </Row>
          </CardContent>
        </Card>
      );

    case "partial_pass_far":
      return (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-6">
            <Row icon={<AlertTriangle className="h-5 w-5 text-danger" />}>
              <h3 className="font-semibold mb-1">
                {verdict.passed === "national" ? "National" : "SC"} passed.{" "}
                {verdict.passed === "national" ? "State" : "National"} at{" "}
                {verdict.otherPct}% — meaningful gap.
              </h3>
              <p className="text-sm text-ink-muted">
                Two weeks of focused work on the missing portion before the
                next attempt. Use Practice (smoke runs are fine) and do a full
                Mistakes Test before retaking.
              </p>
            </Row>
          </CardContent>
        </Card>
      );

    case "fail_close":
      return (
        <Card className="border-warn/30 bg-warn/5">
          <CardContent className="pt-6">
            <Row icon={<Compass className="h-5 w-5 text-warn" />}>
              <h3 className="font-semibold mb-1">
                Both portions below — but close (N {verdict.nationalPct}% / S{" "}
                {verdict.statePct}%).
              </h3>
              <p className="text-sm text-ink-muted">
                7-day cooldown, then one Practice + one Mistakes Test before
                your next Final. Focus on{" "}
                {topWeakSpots(report)
                  .slice(0, 3)
                  .map((s, i, arr) => (
                    <React.Fragment key={s}>
                      <span className="font-medium text-ink">{s}</span>
                      {i < arr.length - 1 ? ", " : ""}
                    </React.Fragment>
                  ))}
                .
              </p>
            </Row>
          </CardContent>
        </Card>
      );

    case "fail_far":
      return (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-6">
            <Row icon={<AlertTriangle className="h-5 w-5 text-danger" />}>
              <h3 className="font-semibold mb-1">
                Major gap (N {verdict.nationalPct}% / S {verdict.statePct}%).
              </h3>
              <p className="text-sm text-ink-muted">
                14-day cooldown enforced. Restart the cycle — Practice on weak
                sections, full Mistakes Test, one or two Mocks, then return
                here. Don&apos;t burn through the held-out pool on attempts
                you&apos;re not ready for.
              </p>
            </Row>
          </CardContent>
        </Card>
      );

    case "incomplete":
      return null;
  }
}

function topWeakSpots(report: FinalReportData) {
  return [...report.nationalWeakest, ...report.stateWeakest];
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl grid place-items-center shrink-0 bg-surface border border-border">
        {icon}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function PortionCard({
  label,
  subtitle,
  correct,
  total,
  accuracyPct,
  passPct,
  passed,
  weakest,
}: {
  label: string;
  subtitle: string;
  correct: number;
  total: number;
  accuracyPct: number;
  passPct: number;
  passed: boolean;
  weakest: string[];
}) {
  const b = band(accuracyPct, passPct);
  if (total === 0) {
    return (
      <Card className="opacity-60">
        <CardContent className="pt-6">
          <div className="text-xs text-ink-muted">{label}</div>
          <div className="font-serif text-3xl font-semibold mt-1">
            Not run
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            This portion wasn&apos;t included in this session (partial retake).
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className={cn(passed ? "border-success/30" : "border-danger/30")}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-ink-muted">{label}</div>
            <div className="font-serif text-5xl font-semibold tracking-tight">
              {accuracyPct}
              <span className="text-xl text-ink-muted">%</span>
            </div>
            <div className="text-sm text-ink-muted mt-1">
              {correct} / {total} · {subtitle}
            </div>
          </div>
          <Badge variant={passed ? "success" : "danger"}>
            {passed ? "PASSED" : "NOT YET"}
          </Badge>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full", b.bar)} style={{ width: `${accuracyPct}%` }} />
          <div
            className="absolute top-0 h-2 border-l-2 border-ink/40"
            style={{ left: `${passPct}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-1 text-[10px] text-ink-muted">
          Pass bar at {passPct}%
        </div>
        {weakest.length > 0 && (
          <div className="mt-4 text-xs text-ink-muted">
            <span className="text-ink-muted">Weakest sections in this portion:</span>{" "}
            <span className="text-ink">{weakest.join(" · ")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PassProbCard({
  probability,
  report,
  passPct,
}: {
  probability: number | null;
  report: FinalReportData;
  passPct: number;
}) {
  if (probability == null) return null;
  const pct100 = Math.round(probability * 100);
  const tone =
    pct100 >= 75
      ? "border-success/30 bg-success/5"
      : pct100 >= 50
        ? "border-warn/30 bg-warn/5"
        : "border-danger/30 bg-danger/5";
  return (
    <Card className={tone}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-1">
          <Compass className="h-4 w-4 text-ink-muted" />
          <h3 className="font-semibold">Predicted real-exam pass probability</h3>
        </div>
        <p className="text-sm text-ink-muted">
          Based on this Final&apos;s observed accuracy, treating each portion
          as a binomial sample:{" "}
          {report.nationalTotal > 0 && report.stateTotal > 0 ? (
            <>
              P(national pass) × P(state pass) ≈{" "}
              <span className="font-medium text-ink">{pct100}%</span>.
            </>
          ) : (
            <>
              P(this portion passes) ≈{" "}
              <span className="font-medium text-ink">{pct100}%</span>.
            </>
          )}{" "}
          Pass is {passPct}% per portion. This is a rough indicator, not a
          guarantee — the real exam draws from a different question set with
          its own scaled-score curve.
        </p>
      </CardContent>
    </Card>
  );
}

function ReviewRow({
  index,
  attempt,
}: {
  index: number;
  attempt: ReviewAttempt;
}) {
  const { open } = useChatSheet();
  const [expanded, setExpanded] = React.useState(false);
  const { question: q, user_answer, is_correct } = attempt;
  const portion = q.section_code.startsWith("A") ? "Nat." : "SC";
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
          {is_correct ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-muted">
            Q{index + 1} · {q.section_code} · {portion} · {q.level}
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
              className={cn(
                "font-medium",
                is_correct ? "text-success" : "text-danger",
              )}
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
        </div>
      )}
    </div>
  );
}

export { FINAL_PASS_PCT };
