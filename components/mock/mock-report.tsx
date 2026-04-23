"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  RotateCcw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Gauge,
  Flag,
  Compass,
  AlertTriangle,
  Trophy,
  Target,
  Timer,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatMs } from "@/lib/utils";
import { useChatSheet } from "@/components/chat/chat-sheet-provider";
import type { QuestionRow } from "@/lib/supabase/types";
import type { Journey } from "@/lib/journey/load";
import { JourneyPanel } from "@/components/results/journey-panel";

/* ------------------------------- types ---------------------------------- */

export type MockAttempt = {
  question: QuestionRow;
  user_answer: "A" | "B" | "C" | "D" | null;
  is_correct: boolean;
};

export type SectionRow = {
  code: string;
  title: string;
  group: "National" | "State";
  total: number;
  correct: number;
  accuracyPct: number;
  /** Predicted accuracy going in (from weighted weakness signal). */
  priorAccuracyPct: number | null;
  /** How many prior attempts fed the prior prediction. */
  priorSampleSize: number;
  /** Recovery points if this section is lifted to passPct. */
  recoverPoints: number;
};

export type Verdict =
  | { kind: "pass"; margin: number; tighten: string[] }
  | { kind: "close"; gap: number; fixSections: string[] }
  | { kind: "far"; gap: number; leaks: string[] };

export type DifficultyBlock = {
  easy: { total: number; correct: number };
  medium: { total: number; correct: number };
  hard: { total: number; correct: number };
};

export type Calibration = {
  predicted: number | null;
  actual: number;
  /** predicted - actual; positive = our model was too optimistic. */
  delta: number | null;
  kind: "calibrated" | "overestimated" | "underestimated" | "unknown";
};

type Props = {
  sessionId: string;
  score: number;
  total: number;
  correct: number;
  durationMs: number;
  passPct: number;
  length: "full" | "smoke";
  nationalCorrect: number;
  nationalTotal: number;
  stateCorrect: number;
  stateTotal: number;
  sections: SectionRow[];
  difficulty: DifficultyBlock;
  verdict: Verdict;
  calibration: Calibration;
  attempts: MockAttempt[];
  journey: Journey;
  aiNote: string;
};

/* ------------------------------- helpers -------------------------------- */

function bandClass(p: number) {
  if (p >= 80) return { bar: "bg-success", text: "text-success" };
  if (p >= 70) return { bar: "bg-success/70", text: "text-success" };
  if (p >= 60) return { bar: "bg-warn", text: "text-warn" };
  return { bar: "bg-danger", text: "text-danger" };
}

function pctRound(correct: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

/* ------------------------------- component ------------------------------- */

export function MockReport({
  sessionId,
  score,
  total,
  correct,
  durationMs,
  passPct,
  length,
  nationalCorrect,
  nationalTotal,
  stateCorrect,
  stateTotal,
  sections,
  difficulty,
  verdict,
  calibration,
  attempts,
  journey,
  aiNote,
}: Props) {
  const passed = score >= passPct;
  const overshoot = score - passPct;
  const totalAnswered = total;
  const avgPerQuestionMs = totalAnswered ? Math.round(durationMs / totalAnswered) : 0;
  const easyP = pctRound(difficulty.easy.correct, difficulty.easy.total);
  const medP = pctRound(difficulty.medium.correct, difficulty.medium.total);
  const hardP = pctRound(difficulty.hard.correct, difficulty.hard.total);
  const weakSections = sections
    .filter((s) => s.total >= 2 && s.accuracyPct < passPct)
    .sort((a, b) => a.accuracyPct - b.accuracyPct);
  const recoverPoints = weakSections
    .slice(0, 3)
    .reduce((acc, s) => acc + s.recoverPoints, 0);

  return (
    <div className="space-y-6">
      {/* -------- Hero -------- */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft">
        <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="capitalize">
                Mock Exam results
              </Badge>
              {length === "smoke" && (
                <Badge variant="secondary">Smoke ({total}Q)</Badge>
              )}
              <Badge variant={passed ? "success" : "danger"}>
                {passed ? "PASSED" : "NOT YET"}
              </Badge>
            </div>
            <div className="flex items-end gap-3">
              <div className="font-serif text-7xl md:text-8xl font-semibold tracking-tight text-ink leading-none">
                {score}
                <span className="text-3xl text-ink-muted">%</span>
              </div>
            </div>
            <p className="mt-3 text-ink-muted">
              {correct} of {total} correct · {formatMs(durationMs)} · Passing:{" "}
              {passPct}%
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild>
              <Link href="/mock-exam">
                <RotateCcw className="h-4 w-4" />
                Retake Mock
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* -------- Honest verdict -------- */}
      <VerdictCard verdict={verdict} passPct={passPct} />

      {/* -------- KPI grid -------- */}
      <KpiGrid
        score={score}
        passed={passed}
        overshoot={overshoot}
        nationalCorrect={nationalCorrect}
        nationalTotal={nationalTotal}
        stateCorrect={stateCorrect}
        stateTotal={stateTotal}
        easyP={easyP}
        medP={medP}
        hardP={hardP}
        avgPerQuestionMs={avgPerQuestionMs}
        weakCount={weakSections.length}
        recoverPoints={recoverPoints}
        passPct={passPct}
      />

      {/* -------- AI coach note -------- */}
      {aiNote && <AINotePanel note={aiNote} />}

      {/* -------- Cross-mode journey -------- */}
      <JourneyPanel journey={journey} currentSessionId={sessionId} />

      {/* -------- National / State sub-scores -------- */}
      <div className="grid gap-4 md:grid-cols-2">
        <SubscoreGauge
          label="National"
          correct={nationalCorrect}
          total={nationalTotal}
          passPct={passPct}
          hint="Sections A1–A6. The real exam has 80 here."
        />
        <SubscoreGauge
          label="South Carolina"
          correct={stateCorrect}
          total={stateTotal}
          passPct={passPct}
          hint="Sections B1–B6. The real exam has 40 here."
        />
      </div>

      {/* -------- Section matrix -------- */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Section matrix</h3>
            <Badge variant="outline" className="ml-auto text-[10px]">
              Pass bar {passPct}%
            </Badge>
          </div>
          <div className="space-y-2">
            {sections.map((s) => (
              <SectionMatrixRow key={s.code} row={s} passPct={passPct} />
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-muted">
            Δ compares your mock accuracy to the model&apos;s prior prediction
            (weighted from Assessment + Practice + Mistakes).
          </p>
        </CardContent>
      </Card>

      {/* -------- Difficulty pulse -------- */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Difficulty pulse</h3>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <DifficultyCard label="Easy" block={difficulty.easy} />
            <DifficultyCard label="Medium" block={difficulty.medium} />
            <DifficultyCard label="Hard" block={difficulty.hard} />
          </div>
          <p className="mt-4 text-xs text-ink-muted">
            {difficultyTip(difficulty)}
          </p>
        </CardContent>
      </Card>

      {/* -------- Calibration -------- */}
      <CalibrationCard calibration={calibration} />

      {/* -------- Review -------- */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Flag className="h-4 w-4 text-primary" />
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

/* ------------------------------ sub-pieces ------------------------------ */

function VerdictCard({
  verdict,
  passPct,
}: {
  verdict: Verdict;
  passPct: number;
}) {
  if (verdict.kind === "pass") {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-success/15 grid place-items-center shrink-0">
              <Trophy className="h-5 w-5 text-success" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">
                  Clean pass — {verdict.margin}{" "}
                  {verdict.margin === 1 ? "point" : "points"} over the line.
                </h3>
              </div>
              <p className="text-sm text-ink-muted">
                Before Final Test, tighten{" "}
                {verdict.tighten.length > 0 ? (
                  <>
                    {verdict.tighten.map((s, i) => (
                      <React.Fragment key={s}>
                        <span className="font-medium text-ink">{s}</span>
                        {i < verdict.tighten.length - 1
                          ? i === verdict.tighten.length - 2
                            ? " and "
                            : ", "
                          : ""}
                      </React.Fragment>
                    ))}{" "}
                    — they were your lowest scoring here.
                  </>
                ) : (
                  <>every section evenly.</>
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/practice">Drill weak sections in Practice</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/final-test">
                    Go to Final Test
                    <Sparkles className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (verdict.kind === "close") {
    return (
      <Card className="border-warn/30 bg-warn/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-warn/15 grid place-items-center shrink-0">
              <Compass className="h-5 w-5 text-warn" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">
                {verdict.gap} {verdict.gap === 1 ? "question" : "questions"}{" "}
                below passing.
              </h3>
              <p className="text-sm text-ink-muted">
                Lifting{" "}
                {verdict.fixSections.map((s, i) => (
                  <React.Fragment key={s}>
                    <span className="font-medium text-ink">{s}</span>
                    {i < verdict.fixSections.length - 1
                      ? i === verdict.fixSections.length - 2
                        ? " and "
                        : ", "
                      : ""}
                  </React.Fragment>
                ))}{" "}
                to {passPct}% would have crossed the line. That&apos;s your
                shortest path.
              </p>
              <div className="mt-3">
                <Button asChild size="sm">
                  <Link href="/practice">Target those sections</Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-danger/30 bg-danger/5">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-danger/15 grid place-items-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-danger" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">
              {verdict.gap} {verdict.gap === 1 ? "question" : "questions"} below
              passing — meaningful gap.
            </h3>
            <p className="text-sm text-ink-muted">
              Your biggest leaks:{" "}
              {verdict.leaks.map((s, i) => (
                <React.Fragment key={s}>
                  <span className="font-medium text-ink">{s}</span>
                  {i < verdict.leaks.length - 1 ? ", " : ""}
                </React.Fragment>
              ))}
              . Drill these in Practice, then run a Mistakes Test before
              retaking.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/practice">Practice</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/mistakes">Mistakes Test</Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SubscoreGauge({
  label,
  correct,
  total,
  passPct,
  hint,
}: {
  label: string;
  correct: number;
  total: number;
  passPct: number;
  hint: string;
}) {
  const p = pctRound(correct, total);
  const band = bandClass(p);
  const passed = p >= passPct && total > 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-ink-muted">{label} subscore</div>
            <div className="font-serif text-5xl font-semibold tracking-tight">
              {p}
              <span className="text-xl text-ink-muted">%</span>
            </div>
            <div className="text-sm text-ink-muted mt-1">
              {correct} / {total}
            </div>
          </div>
          {total > 0 && (
            <Badge variant={passed ? "success" : "danger"}>
              {passed ? "Above bar" : "Below bar"}
            </Badge>
          )}
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full", band.bar)} style={{ width: `${p}%` }} />
          <div
            className="relative -top-2 h-2 border-l-2 border-ink/30"
            style={{ marginLeft: `${passPct}%` }}
            aria-hidden
          />
        </div>
        <p className="mt-3 text-xs text-ink-muted">{hint}</p>
      </CardContent>
    </Card>
  );
}

function SectionMatrixRow({
  row,
  passPct,
}: {
  row: SectionRow;
  passPct: number;
}) {
  const band = bandClass(row.accuracyPct);
  const delta =
    row.priorAccuracyPct != null
      ? row.accuracyPct - row.priorAccuracyPct
      : null;
  const lowSample = row.total < 3;
  const belowBar = row.total > 0 && row.accuracyPct < passPct;

  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline">{row.code}</Badge>
          <span className="text-sm text-ink truncate max-w-[200px] md:max-w-[280px]">
            {row.title}
          </span>
          <span className="text-xs text-ink-muted shrink-0">
            ({row.group === "National" ? "Nat." : "SC"})
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {belowBar && (
            <Badge variant="danger" className="text-[10px]">
              Below bar
            </Badge>
          )}
          {lowSample && (
            <Badge variant="secondary" className="text-[10px]">
              Low sample
            </Badge>
          )}
          <DeltaChip delta={delta} priorSamples={row.priorSampleSize} />
          <span className="text-sm text-ink-muted tabular-nums">
            {row.correct}/{row.total}
          </span>
          <span
            className={cn("font-medium w-10 text-right tabular-nums", band.text)}
          >
            {row.accuracyPct}%
          </span>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full", band.bar)}
          style={{ width: `${row.accuracyPct}%` }}
        />
      </div>
    </div>
  );
}

function DeltaChip({
  delta,
  priorSamples,
}: {
  delta: number | null;
  priorSamples: number;
}) {
  if (delta === null || priorSamples < 3) {
    return (
      <span className="text-[10px] text-ink-muted inline-flex items-center gap-1">
        <Minus className="h-3 w-3" />
        no prior
      </span>
    );
  }
  const rounded = Math.round(delta);
  if (rounded === 0) {
    return (
      <span className="text-[11px] text-ink-muted inline-flex items-center gap-1">
        <Minus className="h-3 w-3" />
        flat
      </span>
    );
  }
  if (rounded > 0) {
    return (
      <span className="text-[11px] text-success inline-flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />+{rounded}
      </span>
    );
  }
  return (
    <span className="text-[11px] text-danger inline-flex items-center gap-1">
      <TrendingDown className="h-3 w-3" />
      {rounded}
    </span>
  );
}

function DifficultyCard({
  label,
  block,
}: {
  label: string;
  block: { total: number; correct: number };
}) {
  const p = pctRound(block.correct, block.total);
  const band = bandClass(p);
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        <span className={cn("text-sm font-medium tabular-nums", band.text)}>
          {p}%
        </span>
      </div>
      <div className="text-xs text-ink-muted mb-2">
        {block.correct}/{block.total}
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full", band.bar)} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function difficultyTip(d: DifficultyBlock) {
  const e = pctRound(d.easy.correct, d.easy.total);
  const m = pctRound(d.medium.correct, d.medium.total);
  const h = pctRound(d.hard.correct, d.hard.total);
  if (d.easy.total === 0 && d.medium.total === 0 && d.hard.total === 0) {
    return "No difficulty data yet.";
  }
  if (e >= 80 && m >= 70 && h >= 60) {
    return "Balanced across difficulty — you're reading the material, not pattern-matching.";
  }
  if (e < 80) {
    return "Easies are leaking. Double-check the reading on your weakest sections — those are the cheap points.";
  }
  if (m < 60) {
    return "Mediums are the soft spot. Practice in Mistakes mode and slow down on wordy stems.";
  }
  if (h < 50) {
    return "Hards are heavy. Expected — this is where the bar raises you. Target hard-only drills after you firm up mediums.";
  }
  return "Mixed bag. Lean into whichever tier is lowest first.";
}

function CalibrationCard({ calibration }: { calibration: Calibration }) {
  if (calibration.kind === "unknown" || calibration.predicted === null) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-2">
            <Compass className="h-4 w-4 text-ink-muted" />
            <h3 className="font-semibold">Model calibration</h3>
          </div>
          <p className="text-sm text-ink-muted">
            Not enough prior attempts to compare this mock to the model&apos;s
            prediction. Run a Practice or Mistakes session and retake to see
            calibration.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { predicted, actual, delta, kind } = calibration;
  const tone =
    kind === "calibrated"
      ? { wrap: "border-success/30 bg-success/5", icon: "text-success" }
      : kind === "overestimated"
        ? { wrap: "border-warn/30 bg-warn/5", icon: "text-warn" }
        : { wrap: "border-primary/30 bg-primary/5", icon: "text-primary" };

  const summary =
    kind === "calibrated"
      ? `Our model predicted ${predicted}% and you scored ${actual}% — the weakness signal is calibrated for you. Trust it.`
      : kind === "overestimated"
        ? `We predicted ${predicted}% but you scored ${actual}% (${Math.abs(delta!)}-pt overestimate). Your recent practice looked better than your exam-conditions performance — that usually means timing or stamina, not knowledge.`
        : `We predicted ${predicted}% but you scored ${actual}% (${Math.abs(delta!)}-pt underestimate). You overperformed the model — either the prior signal is stale, or hint-heavy Practice sessions were dragging your predicted score down.`;

  return (
    <Card className={cn(tone.wrap)}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-2">
          <Compass className={cn("h-4 w-4", tone.icon)} />
          <h3 className="font-semibold">Model calibration</h3>
        </div>
        <p className="text-sm text-ink-muted">{summary}</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ KPI grid -------------------------------- */

function KpiGrid(props: {
  score: number;
  passed: boolean;
  overshoot: number;
  nationalCorrect: number;
  nationalTotal: number;
  stateCorrect: number;
  stateTotal: number;
  easyP: number;
  medP: number;
  hardP: number;
  avgPerQuestionMs: number;
  weakCount: number;
  recoverPoints: number;
  passPct: number;
}) {
  const {
    score,
    passed,
    overshoot,
    nationalCorrect,
    nationalTotal,
    stateCorrect,
    stateTotal,
    hardP,
    avgPerQuestionMs,
    weakCount,
    recoverPoints,
  } = props;

  const nationalP = pctRound(nationalCorrect, nationalTotal);
  const stateP = pctRound(stateCorrect, stateTotal);
  const subscoreSpread = Math.abs(nationalP - stateP);

  const tiles: KpiTileProps[] = [
    {
      icon: Target,
      tone: passed ? "success" : "danger",
      label: passed ? "Margin over bar" : "Gap to bar",
      value: `${passed ? "+" : ""}${overshoot}`,
      sub: passed
        ? `${score}% with the bar at ${props.passPct}%`
        : `${Math.abs(overshoot)} pts under the line`,
    },
    {
      icon: Compass,
      tone: subscoreSpread <= 5 ? "success" : subscoreSpread <= 12 ? "warn" : "danger",
      label: "Sub-score balance",
      value: `${subscoreSpread}pt`,
      sub:
        nationalP >= stateP
          ? `Nat ${nationalP}% · SC ${stateP}%`
          : `SC ${stateP}% · Nat ${nationalP}%`,
    },
    {
      icon: Flame,
      tone: hardP >= 60 ? "success" : hardP >= 45 ? "warn" : "danger",
      label: "Hard-question pulse",
      value: `${hardP}%`,
      sub: `Easy and medium tracked separately below`,
    },
    {
      icon: Timer,
      tone: avgPerQuestionMs <= 60_000 ? "success" : avgPerQuestionMs <= 90_000 ? "warn" : "danger",
      label: "Avg per question",
      value: avgPerQuestionMs ? formatMs(avgPerQuestionMs) : "—",
      sub: `Real exam allows ~72 sec/Q`,
    },
    {
      icon: AlertTriangle,
      tone: weakCount === 0 ? "success" : weakCount <= 2 ? "warn" : "danger",
      label: "Sections below bar",
      value: weakCount,
      sub:
        weakCount === 0
          ? `Every section cleared the bar`
          : `Lifting top ${Math.min(weakCount, 3)} would add ~${recoverPoints} pts`,
    },
  ];

  return (
    <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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

function KpiTile({
  icon: Icon,
  tone,
  label,
  value,
  sub,
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

/* ------------------------------- AI note -------------------------------- */

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
              Personal read on this mock — drawn from your full journey.
            </p>
          </div>
        </div>
        <div className="text-sm text-ink leading-relaxed whitespace-pre-line">
          {note}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ review row ------------------------------ */

function ReviewRow({
  index,
  attempt,
}: {
  index: number;
  attempt: MockAttempt;
}) {
  const { open } = useChatSheet();
  const [expanded, setExpanded] = React.useState(false);
  const { question: q, user_answer, is_correct } = attempt;
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
            Q{index + 1} · {q.section_code} · {q.level}
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
