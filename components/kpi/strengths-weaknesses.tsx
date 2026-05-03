"use client";

import { cn } from "@/lib/utils";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";
import type { SectionMastery } from "@/lib/kpi/stats";

export function StrengthsWeaknesses({
  strengths,
  weaknesses,
}: {
  strengths: SectionMastery[];
  weaknesses: SectionMastery[];
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-6">
      <Column
        title="Top strengths"
        items={strengths}
        empty="Take a practice to see your best sections."
        tone="success"
      />
      <Column
        title="Focus next"
        items={weaknesses}
        empty="Nothing to drill yet."
        tone="danger"
      />
    </div>
  );
}

function Column({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: SectionMastery[];
  empty: string;
  tone: "success" | "danger";
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-ink-muted mb-3">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((s) => (
            <div key={s.code}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink leading-snug">
                  {formatSectionDisplayLabel(s.code)}
                </span>
                <span className="tabular-nums text-ink-muted">{s.accuracy}%</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    tone === "success" ? "bg-success" : "bg-danger",
                  )}
                  style={{ width: `${s.accuracy}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
