"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { QuestionCard } from "@/components/runner/question-card";
import { ExamTimer } from "@/components/runner/exam-timer";
import { QuestionNavigator } from "@/components/runner/question-navigator";
import type { QuestionRow } from "@/lib/supabase/types";
import { pct } from "@/lib/utils";
import { ArrowRight, Clock, Flag, Lock } from "lucide-react";
import {
  FINAL_NATIONAL_DURATION_MIN,
  FINAL_STATE_DURATION_MIN,
} from "@/lib/final/pick-questions";

type Phase = "national" | "transition" | "state";

type AnswerState = {
  selected: "A" | "B" | "C" | "D" | null;
  flagged: boolean;
  attemptStart: number;
};

type Props = {
  sessionId: string;
  nationalQuestions: QuestionRow[];
  stateQuestions: QuestionRow[];
  /** ISO timestamp the National phase began (set by start API as session.started_at). */
  nationalStartedAtMs: number;
  /** Single-portion run? Used for partial retake. */
  initialPhase?: Phase;
  resultsPath: string;
};

/**
 * Two-phase Final Exam runner — mirrors PSI structure:
 *   Phase 1: National, 80 Q, 120 min hard timer.
 *   Transition: optional break.
 *   Phase 2: State,    40 Q, 60 min hard timer.
 *
 * No hints, no AI, no reveal until results page. When a phase timer
 * expires, the phase auto-submits and we move on. When the user is in
 * partial-retake mode, only the relevant phase runs.
 */
export function FinalExamRunner({
  sessionId,
  nationalQuestions,
  stateQuestions,
  nationalStartedAtMs,
  initialPhase,
  resultsPath,
}: Props) {
  const router = useRouter();

  const hasNational = nationalQuestions.length > 0;
  const hasState = stateQuestions.length > 0;

  // Determine starting phase honestly:
  // - explicit override wins (partial retake)
  // - else National if present, otherwise State.
  const startingPhase: Phase =
    initialPhase ??
    (hasNational ? "national" : hasState ? "state" : "national");

  const [phase, setPhase] = React.useState<Phase>(startingPhase);
  const [index, setIndex] = React.useState(0);
  const [submittingPhase, setSubmittingPhase] = React.useState(false);
  const [finishing, setFinishing] = React.useState(false);

  // State phase has its own startedAt assigned when phase 2 begins.
  const [stateStartedAtMs, setStateStartedAtMs] = React.useState<number | null>(
    startingPhase === "state" ? Date.now() : null,
  );

  const [nationalStates, setNationalStates] = React.useState<AnswerState[]>(
    () =>
      nationalQuestions.map(() => ({
        selected: null,
        flagged: false,
        attemptStart: Date.now(),
      })),
  );
  const [stateStates, setStateStates] = React.useState<AnswerState[]>(() =>
    stateQuestions.map(() => ({
      selected: null,
      flagged: false,
      attemptStart: Date.now(),
    })),
  );

  // Track whether each phase has been submitted (attempts recorded).
  const nationalSubmittedRef = React.useRef(false);
  const stateSubmittedRef = React.useRef(false);

  // ---------- derived per-phase data ----------
  const activeQuestions =
    phase === "state" ? stateQuestions : nationalQuestions;
  const activeStates = phase === "state" ? stateStates : nationalStates;
  const setActiveStates =
    phase === "state" ? setStateStates : setNationalStates;
  const total = activeQuestions.length;
  const current = activeQuestions[index];
  const stateAt = activeStates[index];
  const phaseLabel =
    phase === "state" ? "South Carolina portion" : "National portion";
  const phaseDurationMin =
    phase === "state"
      ? FINAL_STATE_DURATION_MIN
      : FINAL_NATIONAL_DURATION_MIN;
  const phaseStartedAtMs =
    phase === "state" ? (stateStartedAtMs ?? Date.now()) : nationalStartedAtMs;

  // ---------- helpers ----------
  const setCurrent = React.useCallback(
    (patch: Partial<AnswerState>) => {
      setActiveStates((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    [index, setActiveStates],
  );

  function jumpTo(i: number) {
    setIndex(i);
    setActiveStates((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], attemptStart: Date.now() };
      return next;
    });
  }

  function onAnswer(letter: "A" | "B" | "C" | "D") {
    if (!current) return;
    setCurrent({ selected: letter });
  }

  function onToggleFlag() {
    setCurrent({ flagged: !stateAt?.flagged });
  }

  function onNext() {
    if (index < total - 1) jumpTo(index + 1);
    else void submitPhase();
  }

  // Record every attempt for the current phase to the attempts API.
  async function recordPhaseAttempts(
    questions: QuestionRow[],
    states: AnswerState[],
  ) {
    await Promise.all(
      questions.map(async (q, i) => {
        const s = states[i];
        const correct = !!s.selected && s.selected === q.correct_option;
        await fetch("/api/attempts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            question_id: q.id,
            mode: "final",
            user_answer: s.selected,
            is_correct: correct,
            hinted: false,
            retried: false,
            time_spent_ms: 0,
          }),
        });
      }),
    );
  }

  // Submit the current phase (timer expired or user pressed submit).
  // - National → moves to transition screen, then state.
  // - State (or single-phase) → finalize the session & redirect.
  async function submitPhase() {
    if (submittingPhase || finishing) return;
    setSubmittingPhase(true);
    try {
      if (phase === "national") {
        if (!nationalSubmittedRef.current) {
          await recordPhaseAttempts(nationalQuestions, nationalStates);
          nationalSubmittedRef.current = true;
        }
        if (hasState) {
          // Move to transition screen — user starts the State timer manually.
          setPhase("transition");
          setIndex(0);
        } else {
          await finalize();
        }
      } else if (phase === "state") {
        if (!stateSubmittedRef.current) {
          await recordPhaseAttempts(stateQuestions, stateStates);
          stateSubmittedRef.current = true;
        }
        await finalize();
      }
    } finally {
      setSubmittingPhase(false);
    }
  }

  function startStatePhase() {
    setStateStartedAtMs(Date.now());
    setPhase("state");
    setIndex(0);
  }

  async function finalize() {
    setFinishing(true);
    // Combined % is informational only — the report computes per-portion
    // pass/fail from the recorded attempts. We send combined for the
    // existing /finish endpoint's score_pct field.
    const totalQ = nationalQuestions.length + stateQuestions.length;
    let correctQ = 0;
    nationalQuestions.forEach((q, i) => {
      if (nationalStates[i].selected === q.correct_option) correctQ += 1;
    });
    stateQuestions.forEach((q, i) => {
      if (stateStates[i].selected === q.correct_option) correctQ += 1;
    });
    const score = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
    const endedAt = Date.now();
    const elapsedMs = endedAt - nationalStartedAtMs;

    try {
      await fetch(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ score_pct: score, duration_ms: elapsedMs }),
      });
    } catch (e) {
      console.error(e);
    }
    router.replace(resultsPath);
  }

  // ---------- transition screen ----------
  if (phase === "transition") {
    return (
      <div className="space-y-6">
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-success/15 grid place-items-center shrink-0">
                <Flag className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <h2 className="font-serif text-2xl font-semibold">
                  National portion submitted.
                </h2>
                <p className="mt-2 text-ink-muted">
                  On the real PSI exam you can take a brief unscored break
                  here. The State portion is{" "}
                  <span className="font-medium text-ink">
                    {stateQuestions.length} questions / {FINAL_STATE_DURATION_MIN}{" "}
                    minutes
                  </span>
                  . Your National score is locked and won&apos;t be revealed
                  until the entire exam is complete.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={startStatePhase}>
                    Start State portion
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- exam phase ----------
  const answeredCount = activeStates.filter((s) => s.selected !== null).length;
  const progress = pct(index + 1, total);
  const navStates = activeStates.map((s) =>
    s.flagged ? "flagged" : s.selected ? "answered" : "unanswered",
  ) as ("answered" | "flagged" | "unanswered")[];

  return (
    <div className="space-y-4">
      {/* Phase header */}
      <Card className="border-border">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="capitalize">
                Final · {phaseLabel}
              </Badge>
              <span className="text-sm text-ink-muted inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {total} questions · {phaseDurationMin} minutes
              </span>
              <span className="text-xs text-ink-muted inline-flex items-center gap-1">
                <Lock className="h-3 w-3" /> No hints · No AI
              </span>
            </div>
            <ExamTimer
              durationMs={phaseDurationMin * 60 * 1000}
              startedAt={phaseStartedAtMs}
              onExpire={submitPhase}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-[1fr_260px] gap-6">
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-3 text-sm text-ink-muted">
              <span className="font-medium text-ink">Question {index + 1}</span>
              <span>of {total}</span>
              {answeredCount > 0 && (
                <span className="text-xs">({answeredCount} answered)</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void submitPhase()}
                disabled={submittingPhase || finishing}
              >
                {phase === "state" || !hasState
                  ? "Submit Final"
                  : "Submit National & continue"}
              </Button>
            </div>
          </div>
          <Progress value={progress} className="mb-6" />

          <AnimatePresence mode="wait">
            <QuestionCard
              key={current?.id ?? index}
              question={current}
              index={index}
              total={total}
              mode="final"
              behavior="exam"
              flagged={stateAt?.flagged}
              initialAnswer={stateAt?.selected ?? null}
              revealedAnswer={null}
              onAnswer={onAnswer}
              onToggleFlag={onToggleFlag}
              onNext={onNext}
            />
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => jumpTo(Math.max(0, index - 1))}
              disabled={index === 0}
            >
              Previous
            </Button>
            <Button
              variant={index === total - 1 ? "default" : "outline"}
              onClick={onNext}
            >
              {index === total - 1
                ? phase === "state" || !hasState
                  ? "Submit Final"
                  : "Submit National & continue"
                : "Next question"}
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          <QuestionNavigator
            total={total}
            currentIndex={index}
            states={navStates}
            onJump={jumpTo}
          />
        </div>
      </div>
    </div>
  );
}
