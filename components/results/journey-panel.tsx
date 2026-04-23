"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Compass,
  GraduationCap,
  AlertTriangle,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Journey, JourneyMode, JourneyPoint } from "@/lib/journey/load";

/* ---------------------------------------------------------------------- *
 * JourneyPanel
 *
 * Cross-mode performance view used on every results screen. Renders:
 *   - 4 mode tiles (latest score, best, run count, delta).
 *   - A combined sparkline of the most recent finished sessions across
 *     all four modes, color-coded by mode.
 *   - Optional `currentSessionId` highlights the run that just ended.
 * ---------------------------------------------------------------------- */

const MODE_META: Record<
  JourneyMode,
  {
    label: string;
    short: string;
    text: string;
    bg: string;
    fill: string;
    stroke: string;
    ring: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  assessment: {
    label: "Assessment",
    short: "ASMT",
    text: "text-ink",
    bg: "bg-ink/10",
    fill: "fill-ink",
    stroke: "stroke-ink",
    ring: "ring-ink/30",
    icon: Compass,
  },
  practice: {
    label: "Practice",
    short: "PRAC",
    text: "text-primary",
    bg: "bg-primary/10",
    fill: "fill-primary",
    stroke: "stroke-primary",
    ring: "ring-primary/30",
    icon: GraduationCap,
  },
  mistakes: {
    label: "Mistakes",
    short: "MIST",
    text: "text-warn",
    bg: "bg-warn/10",
    fill: "fill-warn",
    stroke: "stroke-warn",
    ring: "ring-warn/30",
    icon: AlertTriangle,
  },
  mock: {
    label: "Mock Exam",
    short: "MOCK",
    text: "text-success",
    bg: "bg-success/10",
    fill: "fill-success",
    stroke: "stroke-success",
    ring: "ring-success/30",
    icon: Trophy,
  },
};

const MODE_ORDER: JourneyMode[] = ["assessment", "practice", "mistakes", "mock"];

export function JourneyPanel({
  journey,
  currentSessionId,
}: {
  journey: Journey;
  currentSessionId?: string;
}) {
  const totalRuns = MODE_ORDER.reduce(
    (acc, m) => acc + journey.perMode[m].runs.length,
    0,
  );

  if (totalRuns === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Your journey</h3>
          <Badge variant="outline" className="ml-auto text-[10px]">
            Last {journey.combined.length} runs
          </Badge>
        </div>
        <p className="text-xs text-ink-muted mb-4">
          Performance across Assessment, Practice, Mistakes and Mock — the
          arc that gets you to the Final Test.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {MODE_ORDER.map((m) => (
            <ModeTile
              key={m}
              mode={m}
              series={journey.perMode[m]}
              isCurrent={
                !!currentSessionId &&
                journey.perMode[m].runs.some((r) => r.id === currentSessionId)
              }
            />
          ))}
        </div>

        <CombinedTimeline points={journey.combined} currentSessionId={currentSessionId} />
      </CardContent>
    </Card>
  );
}

/* ----------------------------- mode tile ----------------------------- */

function ModeTile({
  mode,
  series,
  isCurrent,
}: {
  mode: JourneyMode;
  series: Journey["perMode"][JourneyMode];
  isCurrent: boolean;
}) {
  const meta = MODE_META[mode];
  const Icon = meta.icon;
  const empty = series.runs.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative rounded-xl border border-border p-3",
        isCurrent && cn("ring-2", meta.ring),
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("h-7 w-7 rounded-lg grid place-items-center", meta.bg)}>
          <Icon className={cn("h-3.5 w-3.5", meta.text)} />
        </div>
        <div className="text-xs font-medium text-ink">{meta.label}</div>
        {isCurrent && (
          <Badge variant="secondary" className="ml-auto text-[9px] px-1.5">
            this run
          </Badge>
        )}
      </div>

      {empty ? (
        <div className="text-xs text-ink-muted">Not yet attempted.</div>
      ) : (
        <>
          <div className="flex items-baseline gap-1">
            <div className="font-serif text-3xl font-semibold tracking-tight tabular-nums">
              {series.latest ?? "—"}
            </div>
            <div className="text-sm text-ink-muted">%</div>
            <DeltaPill delta={series.delta} className="ml-auto" />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-ink-muted">
            <span>Best {series.best ?? "—"}%</span>
            <span>{series.runs.length} run{series.runs.length === 1 ? "" : "s"}</span>
          </div>
          <ModeSparkline runs={series.runs} mode={mode} />
        </>
      )}
    </motion.div>
  );
}

function DeltaPill({ delta, className }: { delta: number | null; className?: string }) {
  if (delta == null) {
    return (
      <span className={cn("text-[10px] text-ink-muted inline-flex items-center gap-0.5", className)}>
        <Minus className="h-2.5 w-2.5" />
        first
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span className={cn("text-[10px] text-ink-muted inline-flex items-center gap-0.5", className)}>
        <Minus className="h-2.5 w-2.5" />
        flat
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className={cn("text-[10px] text-success inline-flex items-center gap-0.5", className)}>
        <TrendingUp className="h-2.5 w-2.5" />+{delta}
      </span>
    );
  }
  return (
    <span className={cn("text-[10px] text-danger inline-flex items-center gap-0.5", className)}>
      <TrendingDown className="h-2.5 w-2.5" />
      {delta}
    </span>
  );
}

function ModeSparkline({ runs, mode }: { runs: JourneyPoint[]; mode: JourneyMode }) {
  const meta = MODE_META[mode];
  const points = [...runs]
    .reverse()
    .map((r) => r.score_pct)
    .filter((v): v is number => v != null);

  if (points.length < 2) {
    return <div className="mt-2 h-8 rounded-md bg-muted/40" aria-hidden />;
  }
  const w = 100;
  const h = 28;
  const min = 0;
  const max = 100;
  const stepX = w / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = h - ((p - min) / (max - min)) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="mt-2 w-full h-8 overflow-visible"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        strokeWidth={1.5}
        className={cn(meta.stroke)}
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={i * stepX}
          cy={h - ((p - min) / (max - min)) * h}
          r={i === points.length - 1 ? 1.8 : 1}
          className={meta.fill}
        />
      ))}
    </svg>
  );
}

/* -------------------------- combined timeline ------------------------- */

function CombinedTimeline({
  points,
  currentSessionId,
}: {
  points: JourneyPoint[];
  currentSessionId?: string;
}) {
  const scored = points.filter(
    (p): p is JourneyPoint & { score_pct: number } => p.score_pct != null,
  );
  if (scored.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-xs text-ink-muted text-center">
        Run more sessions across modes to chart your full journey.
      </div>
    );
  }

  const w = 600;
  const h = 110;
  const padX = 12;
  const padY = 14;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const stepX = scored.length > 1 ? innerW / (scored.length - 1) : 0;
  const yFor = (p: number) => padY + (1 - p / 100) * innerH;
  const xFor = (i: number) => padX + i * stepX;

  const linePath = scored
    .map((s, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(s.score_pct).toFixed(1)}`)
    .join(" ");

  return (
    <div className="rounded-xl border border-border bg-elevated/30 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[11px] text-ink-muted">
        {MODE_ORDER.map((m) => (
          <div key={m} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                MODE_META[m].text.replace("text-", "bg-"),
              )}
              aria-hidden
            />
            <span>{MODE_META[m].label}</span>
          </div>
        ))}
        <span className="ml-auto">Earliest → Latest</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="w-full h-[140px]"
      >
        {[25, 50, 75].map((g) => (
          <line
            key={g}
            x1={padX}
            x2={w - padX}
            y1={yFor(g)}
            y2={yFor(g)}
            className="stroke-border"
            strokeWidth={0.5}
            strokeDasharray="2 4"
          />
        ))}
        <line
          x1={padX}
          x2={w - padX}
          y1={yFor(70)}
          y2={yFor(70)}
          className="stroke-success/60"
          strokeWidth={0.7}
          strokeDasharray="3 3"
        />
        <text
          x={w - padX}
          y={yFor(70) - 2}
          textAnchor="end"
          className="fill-success text-[8px]"
        >
          Pass bar
        </text>
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          className="text-ink-muted/50"
        />
        {scored.map((s, i) => {
          const meta = MODE_META[s.mode];
          const isCurrent = currentSessionId === s.id;
          return (
            <g key={s.id + i}>
              <circle
                cx={xFor(i)}
                cy={yFor(s.score_pct)}
                r={isCurrent ? 5 : 3}
                className={meta.fill}
                stroke="white"
                strokeWidth={1}
              />
              {isCurrent && (
                <circle
                  cx={xFor(i)}
                  cy={yFor(s.score_pct)}
                  r={8}
                  fill="none"
                  className={meta.stroke}
                  strokeWidth={1.2}
                  strokeDasharray="2 2"
                />
              )}
              <title>
                {meta.label}: {s.score_pct}%
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
