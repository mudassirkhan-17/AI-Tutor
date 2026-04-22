"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

export function KpiStatCard({
  label,
  value,
  delta,
  icon,
  spark,
  index = 0,
  suffix,
}: {
  label: string;
  value: number | string;
  delta?: number | null;
  icon?: React.ReactNode;
  spark?: number[];
  index?: number;
  suffix?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
    >
      <Card className="relative overflow-hidden group">
        <CardContent className="p-5 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-muted">
              {icon}
              {label}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-serif text-4xl font-semibold text-ink tabular-nums">
                {value}
              </span>
              {suffix && (
                <span className="text-lg text-ink-muted">{suffix}</span>
              )}
            </div>
            {typeof delta === "number" && delta !== 0 && (
              <div
                className={cn(
                  "mt-1 text-xs font-medium",
                  delta > 0 ? "text-success" : "text-danger",
                )}
              >
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} pts vs. 7d
              </div>
            )}
          </div>
          {spark && spark.length > 1 && (
            <div className="w-24 h-12 opacity-80 group-hover:opacity-100 transition-opacity">
              <Sparkline values={spark} height={48} />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
