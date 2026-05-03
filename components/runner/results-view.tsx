"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatMs, pct } from "@/lib/utils";
import {
  Trophy,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import * as React from "react";
import { useChatSheet } from "@/components/chat/chat-sheet-provider";
import type { QuestionRow } from "@/lib/supabase/types";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";

export type AttemptSummary = {
  question: QuestionRow;
  user_answer: "A" | "B" | "C" | "D" | null;
  is_correct: boolean;
};

export function ResultsView({
  mode,
  score,
  total,
  correct,
  durationMs,
  passPct,
  attempts,
  primaryRetryHref,
}: {
  mode: string;
  score: number;
  total: number;
  correct: number;
  durationMs: number;
  passPct?: number;
  attempts: AttemptSummary[];
  primaryRetryHref: string;
}) {
  const { open } = useChatSheet();
  const passed = typeof passPct === "number" ? score >= passPct : true;

  const bySection = React.useMemo(() => {
    const m = new Map<string, { total: number; correct: number }>();
    for (const a of attempts) {
      const cur = m.get(a.question.section_code) ?? { total: 0, correct: 0 };
      cur.total += 1;
      cur.correct += a.is_correct ? 1 : 0;
      m.set(a.question.section_code, cur);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [attempts]);

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft"
      >
        <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <Badge variant="outline" className="mb-3 capitalize">
              {mode} results
            </Badge>
            <div className="flex items-end gap-3">
              <div className="font-serif text-7xl md:text-8xl font-semibold tracking-tight text-ink leading-none">
                {score}
                <span className="text-3xl text-ink-muted">%</span>
              </div>
              {typeof passPct === "number" && (
                <Badge
                  variant={passed ? "success" : "danger"}
                  className="mb-3 text-sm"
                >
                  {passed ? "PASSED" : "NOT YET"}
                </Badge>
              )}
            </div>
            <p className="mt-3 text-ink-muted">
              {correct} of {total} correct · {formatMs(durationMs)}
              {typeof passPct === "number" && (
                <> · Passing: {passPct}%</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
            <Button asChild>
              <Link href={primaryRetryHref}>
                <RotateCcw className="h-4 w-4" /> Retake {mode}
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Per-section breakdown */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Section breakdown</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {bySection.map(([code, s]) => {
              const p = pct(s.correct, s.total);
              return (
                <div
                  key={code}
                  className="flex items-center justify-between rounded-xl border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{code}</Badge>
                    <span className="text-sm text-ink-muted">
                      {s.correct}/{s.total}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full",
                          p >= 80 ? "bg-success" : p >= 60 ? "bg-warn" : "bg-danger",
                        )}
                        style={{ width: `${p}%` }}
                      />
                    </div>
                    <span className="font-medium w-10 text-right tabular-nums">
                      {p}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Review individual questions */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Question review</h3>
          <div className="space-y-2">
            {attempts.map((a, i) => (
              <ReviewRow
                key={a.question.id + i}
                index={i}
                attempt={a}
                onAskAI={() =>
                  open({
                    id: a.question.id,
                    section_code: a.question.section_code,
                    prompt: a.question.prompt,
                    option_a: a.question.option_a,
                    option_b: a.question.option_b,
                    option_c: a.question.option_c,
                    option_d: a.question.option_d,
                    correct_option: a.question.correct_option,
                    hint: a.question.hint,
                    explanation: a.question.explanation,
                    user_answer: a.user_answer,
                  })
                }
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewRow({
  index,
  attempt,
  onAskAI,
}: {
  index: number;
  attempt: AttemptSummary;
  onAskAI: () => void;
}) {
  const [open, setOpen] = React.useState(false);
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
        onClick={() => setOpen((v) => !v)}
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
            Q{index + 1} · {formatSectionDisplayLabel(q.section_code)}
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
            <span className="text-ink-muted">Your answer: </span>
            <span className={cn("font-medium", is_correct ? "text-success" : "text-danger")}>
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
          <Button size="sm" variant="soft" onClick={onAskAI}>
            <Sparkles className="h-3.5 w-3.5" /> Ask AI about this question
          </Button>
        </div>
      )}
    </div>
  );
}
