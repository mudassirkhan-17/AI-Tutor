"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SectionMastery } from "@/lib/kpi/stats";

function colorFor(acc: number, total: number) {
  if (total === 0) return "bg-muted text-ink-muted";
  if (acc >= 85) return "bg-success/25 text-success border-success/40";
  if (acc >= 70) return "bg-primary/15 text-primary border-primary/30";
  if (acc >= 55) return "bg-warn/20 text-warn border-warn/40";
  return "bg-danger/15 text-danger border-danger/40";
}

export function MasteryMap({ mastery }: { mastery: SectionMastery[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {mastery.map((m, i) => (
        <Tooltip key={m.code}>
          <TooltipTrigger asChild>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i, duration: 0.25 }}
              className={cn(
                "rounded-xl border p-3 text-sm text-center cursor-default select-none transition-all hover:scale-[1.03]",
                colorFor(m.accuracy, m.total),
              )}
            >
              <div className="font-mono text-xs opacity-70">{m.code}</div>
              <div className="font-serif text-xl font-semibold tabular-nums">
                {m.total === 0 ? "—" : `${m.accuracy}%`}
              </div>
              <div className="text-[10px] opacity-70 truncate">
                {m.total === 0 ? "No data" : `${m.correct}/${m.total}`}
              </div>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="text-xs">
              <div className="font-medium">{m.title}</div>
              <div className="opacity-80 mt-0.5">
                {m.total === 0 ? "Not attempted yet" : `${m.correct}/${m.total} correct`}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
