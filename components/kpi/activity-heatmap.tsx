"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Day = { day: string; attempts: number; correct: number };

function toneFor(n: number) {
  if (n === 0) return "bg-muted";
  if (n < 5) return "bg-primary/20";
  if (n < 15) return "bg-primary/40";
  if (n < 30) return "bg-primary/60";
  return "bg-primary";
}

export function ActivityHeatmap({ days }: { days: Day[] }) {
  const map = new Map(days.map((d) => [d.day, d]));
  // Build a 10 week x 7 day grid ending today
  const cells: { date: string; attempts: number }[] = [];
  const end = new Date();
  for (let i = 69; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: key, attempts: map.get(key)?.attempts ?? 0 });
  }
  // Group into columns of 7 (weeks)
  const weeks: { date: string; attempts: number }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="flex gap-1 overflow-x-auto thin-scroll">
      {weeks.map((w, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {w.map((c) => (
            <Tooltip key={c.date}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "h-3.5 w-3.5 rounded-sm",
                    toneFor(c.attempts),
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="text-xs">
                  <div>{c.date}</div>
                  <div className="opacity-80">{c.attempts} attempts</div>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      ))}
    </div>
  );
}
