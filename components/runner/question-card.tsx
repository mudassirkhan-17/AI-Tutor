"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Flag,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import type { QuestionRow } from "@/lib/supabase/types";
import { useChatSheet } from "@/components/chat/chat-sheet-provider";

export type QuestionCardProps = {
  question: QuestionRow;
  index: number;
  total: number;
  mode: "assessment" | "practice" | "mistakes" | "mock" | "final";
  /**
   * - practice: shows hints + retry banner
   * - exam-like: locked UI, no hint/AI
   */
  behavior: "reveal" | "exam" | "retry-with-hint";
  hintRevealed?: boolean;
  flagged?: boolean;
  initialAnswer?: "A" | "B" | "C" | "D" | null;
  revealedAnswer?: "A" | "B" | "C" | "D" | null; // when behavior=reveal, show correct/incorrect
  onAnswer: (answer: "A" | "B" | "C" | "D") => void;
  onHint?: () => void;
  onToggleFlag?: () => void;
  onNext?: () => void;
};

export function QuestionCard({
  question,
  index,
  total,
  mode: _mode,
  behavior,
  hintRevealed,
  flagged,
  initialAnswer = null,
  revealedAnswer = null,
  onAnswer,
  onHint,
  onToggleFlag,
  onNext,
}: QuestionCardProps) {
  const [selected, setSelected] = React.useState<"A" | "B" | "C" | "D" | null>(initialAnswer);
  React.useEffect(() => setSelected(initialAnswer), [initialAnswer, question.id]);

  const { open: openChat } = useChatSheet();

  const options: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
  const map: Record<string, string> = {
    A: question.option_a,
    B: question.option_b,
    C: question.option_c,
    D: question.option_d,
  };

  const isLocked = behavior === "exam";
  const isRevealed = !!revealedAnswer;

  function handleClick(letter: "A" | "B" | "C" | "D") {
    if (isRevealed) return;
    setSelected(letter);
    onAnswer(letter);
  }

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
      className="rounded-3xl border border-border bg-surface p-6 md:p-8 shadow-soft"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Badge variant="outline">{question.section_code}</Badge>
          <span>·</span>
          <span className="capitalize">{question.level}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span>
            Question {index + 1} <span className="opacity-60">/ {total}</span>
          </span>
          {onToggleFlag && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={onToggleFlag}
              aria-label={flagged ? "Unflag" : "Flag"}
            >
              <Flag className={cn("h-4 w-4", flagged && "fill-warn text-warn")} />
            </Button>
          )}
          {!isLocked && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() =>
                openChat({
                  id: question.id,
                  section_code: question.section_code,
                  prompt: question.prompt,
                  option_a: question.option_a,
                  option_b: question.option_b,
                  option_c: question.option_c,
                  option_d: question.option_d,
                  correct_option: question.correct_option,
                  hint: question.hint,
                  explanation: question.explanation,
                  user_answer: selected,
                })
              }
            >
              <Sparkles className="h-3.5 w-3.5" /> Ask AI
            </Button>
          )}
        </div>
      </div>

      <h2 className="mt-5 font-serif text-2xl md:text-3xl leading-snug text-ink">
        {question.prompt}
      </h2>

      <AnimatePresence>
        {hintRevealed && question.hint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm text-ink flex gap-3"
          >
            <Lightbulb className="h-4 w-4 text-warn shrink-0 mt-0.5" />
            <div>
              <div className="text-xs uppercase tracking-widest text-warn mb-0.5">Hint</div>
              {question.hint}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {behavior === "retry-with-hint" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-5 rounded-2xl border border-primary/30 bg-primary-soft/50 p-4 text-sm text-ink"
        >
          Not quite. Take another look — we&apos;ve revealed a hint to help.
        </motion.div>
      )}

      <div className="mt-6 grid gap-3">
        {options.map((letter) => {
          const isSelected = selected === letter;
          const isCorrect = isRevealed && letter === question.correct_option;
          const isWrong =
            isRevealed && revealedAnswer === letter && letter !== question.correct_option;
          return (
            <button
              key={letter}
              disabled={isRevealed}
              onClick={() => handleClick(letter)}
              className={cn(
                "group relative w-full text-left rounded-2xl border p-4 transition-all focus-ring",
                "flex items-start gap-4",
                !isRevealed && "hover:border-primary/60 hover:bg-elevated active:scale-[0.998]",
                isSelected && !isRevealed && "border-primary bg-primary-soft/40",
                !isSelected && !isRevealed && "border-border bg-surface",
                isCorrect && "border-success bg-success/10",
                isWrong && "border-danger bg-danger/10",
                isRevealed && !isCorrect && !isWrong && "opacity-60",
              )}
            >
              <span
                className={cn(
                  "shrink-0 h-8 w-8 rounded-full grid place-items-center text-sm font-semibold border",
                  isCorrect && "bg-success text-primary-foreground border-transparent",
                  isWrong && "bg-danger text-primary-foreground border-transparent",
                  !isCorrect && !isWrong && isSelected && "bg-primary text-primary-foreground border-transparent",
                  !isCorrect && !isWrong && !isSelected && "bg-muted text-ink-muted border-border",
                )}
              >
                {letter}
              </span>
              <span className="text-ink text-[15px] leading-relaxed flex-1">
                {map[letter]}
              </span>
              {isCorrect && <CheckCircle2 className="h-5 w-5 text-success" />}
              {isWrong && <XCircle className="h-5 w-5 text-danger" />}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {isRevealed && question.explanation && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 rounded-2xl border border-border bg-elevated p-4"
          >
            <div className="text-xs uppercase tracking-widest text-ink-muted mb-1">
              Explanation
            </div>
            <p className="text-sm text-ink leading-relaxed">{question.explanation}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onHint && !hintRevealed && !isLocked && question.hint && (
            <Button variant="ghost" size="sm" onClick={onHint}>
              <Lightbulb className="h-4 w-4" /> Show hint
            </Button>
          )}
        </div>
        {onNext && isRevealed && (
          <Button onClick={onNext}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
