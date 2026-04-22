"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuestionCard } from "./question-card";
import { ExamTimer } from "./exam-timer";
import { QuestionNavigator } from "./question-navigator";
import type { QuestionRow } from "@/lib/supabase/types";
import type { ModeKey } from "@/lib/constants";
import { pct } from "@/lib/utils";

type Props = {
  sessionId: string;
  mode: ModeKey;
  questions: QuestionRow[];
  timed?: { durationMin: number } | null;
  startedAt: number;
  /**
   * Reveal behavior:
   * - "exam": strict, no hints, answers not revealed until finish.
   * - "reveal": show correct answer + explanation after each answer, no retries.
   * - "practice": hint allowed, first wrong shows retry with hint, second wrong reveals.
   */
  behavior: "exam" | "reveal" | "practice";
  /** Full path to results (string only — Server Components cannot pass functions to clients). */
  resultsPath: string;
};

type AnswerState = {
  selected: "A" | "B" | "C" | "D" | null;
  revealed: boolean;       // show correct/incorrect styling + explanation
  hintUsed: boolean;
  triedOnce: boolean;      // for practice retry flow
  retried: boolean;        // logged as retried
  flagged: boolean;
  attemptStart: number;
};

export function QuestionRunner({
  sessionId,
  mode,
  questions,
  timed,
  startedAt,
  behavior,
  resultsPath,
}: Props) {
  const router = useRouter();
  const total = questions.length;
  const [index, setIndex] = React.useState(0);
  const [finishing, setFinishing] = React.useState(false);

  const [states, setStates] = React.useState<AnswerState[]>(() =>
    questions.map(() => ({
      selected: null,
      revealed: false,
      hintUsed: false,
      triedOnce: false,
      retried: false,
      flagged: false,
      attemptStart: Date.now(),
    })),
  );

  const current = questions[index];
  const state = states[index];

  const setCurrent = React.useCallback(
    (patch: Partial<AnswerState>) =>
      setStates((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      }),
    [index],
  );

  async function recordAttempt(
    q: QuestionRow,
    s: AnswerState,
    answer: "A" | "B" | "C" | "D",
    isCorrect: boolean,
  ) {
    const now = Date.now();
    const timeMs = Math.max(0, now - s.attemptStart);
    try {
      await fetch("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: q.id,
          mode,
          user_answer: answer,
          is_correct: isCorrect,
          hinted: s.hintUsed,
          retried: s.retried,
          time_spent_ms: timeMs,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function finish() {
    if (finishing) return;
    setFinishing(true);

    // For exam mode, grade now (answers aren't auto-revealed). Record an
    // attempt for every question, including skipped ones (user_answer=null),
    // so the Review page can show them all.
    if (behavior === "exam") {
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
              mode,
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

    const answeredArr = states.map((s, i) =>
      s.selected ? (s.selected === questions[i].correct_option ? 1 : 0) : null,
    );
    const answered = answeredArr.filter((x) => x !== null) as number[];
    const correct = answered.reduce((a, b) => a + b, 0);
    const score = pct(correct, total);

    try {
      await fetch(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ score_pct: score, duration_ms: Date.now() - startedAt }),
      });
    } catch (e) {
      console.error(e);
    }

    router.replace(resultsPath);
  }

  function onAnswer(letter: "A" | "B" | "C" | "D") {
    if (!current || !state) return;
    const isCorrect = letter === current.correct_option;

    if (behavior === "exam") {
      // Just mark selection; don't reveal, don't record yet.
      setCurrent({ selected: letter });
      return;
    }

    if (behavior === "reveal") {
      setCurrent({ selected: letter, revealed: true });
      recordAttempt(current, state, letter, isCorrect);
      if (isCorrect) toast.success("Correct");
      else toast.error("Not quite — check the explanation.");
      return;
    }

    // practice mode
    if (isCorrect) {
      setCurrent({ selected: letter, revealed: true });
      recordAttempt(current, state, letter, true);
      toast.success(state.triedOnce ? "Got it on retry." : "Correct");
      return;
    }

    // wrong
    if (!state.triedOnce) {
      // first wrong: record as wrong attempt, then show hint + allow retry
      recordAttempt(current, { ...state, retried: false }, letter, false);
      setCurrent({
        selected: null,
        triedOnce: true,
        hintUsed: true,
        retried: true,
        attemptStart: Date.now(),
      });
      return;
    }

    // second wrong: reveal answer + explanation, record wrong
    recordAttempt(current, { ...state, retried: true }, letter, false);
    setCurrent({ selected: letter, revealed: true });
  }

  function onHint() {
    setCurrent({ hintUsed: true });
  }

  function onToggleFlag() {
    setCurrent({ flagged: !state.flagged });
  }

  function jumpTo(i: number) {
    setIndex(i);
    setStates((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], attemptStart: Date.now() };
      return next;
    });
  }

  function onNext() {
    if (index < total - 1) jumpTo(index + 1);
    else finish();
  }

  const answeredCount = states.filter((s) => s.selected !== null && (behavior === "exam" || s.revealed || s.selected !== null)).length;
  const progress = pct(index + 1, total);

  const navStates = states.map((s) =>
    s.flagged ? "flagged" : s.selected ? "answered" : "unanswered",
  ) as ("answered" | "flagged" | "unanswered")[];

  const isExamMode = behavior === "exam";
  const behaviorForCard = isExamMode
    ? ("exam" as const)
    : behavior === "practice" && state?.triedOnce && !state?.revealed
      ? ("retry-with-hint" as const)
      : ("reveal" as const);

  const revealedAnswer =
    !isExamMode && state?.revealed ? state.selected : null;

  return (
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
            {timed && (
              <ExamTimer
                durationMs={timed.durationMin * 60 * 1000}
                startedAt={startedAt}
                onExpire={finish}
              />
            )}
            <Button variant="outline" size="sm" onClick={finish} disabled={finishing}>
              {isExamMode ? "Submit exam" : "Finish"}
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
            mode={mode}
            behavior={behaviorForCard}
            hintRevealed={state?.hintUsed}
            flagged={state?.flagged}
            initialAnswer={state?.selected ?? null}
            revealedAnswer={revealedAnswer}
            onAnswer={onAnswer}
            onHint={onHint}
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
          {isExamMode && (
            <Button
              variant={index === total - 1 ? "default" : "outline"}
              onClick={onNext}
            >
              {index === total - 1 ? "Submit exam" : "Next question"}
            </Button>
          )}
          {!isExamMode && !state?.revealed && state?.selected === null && (
            <Button variant="ghost" onClick={() => jumpTo(Math.min(total - 1, index + 1))}>
              Skip
            </Button>
          )}
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
  );
}
