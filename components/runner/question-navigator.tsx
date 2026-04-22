"use client";

import { cn } from "@/lib/utils";

export type NavState = "unanswered" | "answered" | "flagged" | "current";

export function QuestionNavigator({
  total,
  currentIndex,
  states,
  onJump,
}: {
  total: number;
  currentIndex: number;
  states: ("answered" | "flagged" | "unanswered")[];
  onJump: (i: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-ink">Navigator</span>
        <div className="flex items-center gap-3 text-[10px] text-ink-muted uppercase tracking-wider">
          <Swatch className="bg-muted" label="Unanswered" />
          <Swatch className="bg-primary text-primary-foreground" label="Answered" />
          <Swatch className="bg-warn text-primary-foreground" label="Flagged" />
        </div>
      </div>
      <div className="grid grid-cols-10 gap-1.5">
        {Array.from({ length: total }).map((_, i) => {
          const s = states[i];
          const isCurrent = i === currentIndex;
          return (
            <button
              key={i}
              onClick={() => onJump(i)}
              className={cn(
                "aspect-square rounded-md text-[11px] font-medium transition-all focus-ring",
                s === "unanswered" && "bg-muted text-ink-muted hover:bg-elevated",
                s === "answered" && "bg-primary text-primary-foreground",
                s === "flagged" && "bg-warn text-primary-foreground",
                isCurrent && "ring-2 ring-ring ring-offset-2 ring-offset-surface",
              )}
              aria-label={`Go to question ${i + 1}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", className)} />
      {label}
    </span>
  );
}
