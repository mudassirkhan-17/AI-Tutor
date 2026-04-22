"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Clock, Target, Brain, ListTodo, Timer, Trophy } from "lucide-react";
import type { ModeKey } from "@/lib/constants";

const ICONS = {
  assessment: Target,
  practice: Brain,
  mistakes: ListTodo,
  mock: Timer,
  final: Trophy,
} as const;

export function ModeIntro({
  mode,
  title,
  blurb,
  questionCount,
  durationMin,
  passPct,
  bullets,
  startHref,
  startPath,
  disabled,
  disabledReason,
}: {
  mode: ModeKey;
  title: string;
  blurb: string;
  questionCount: number;
  durationMin?: number;
  passPct?: number;
  bullets: string[];
  startHref?: string;
  /** e.g. "/practice/start" - server action endpoint */
  startPath: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [extraConfig, setExtraConfig] = useState<Record<string, unknown>>({});
  const Icon = ICONS[mode];

  async function begin() {
    if (disabled) return;
    start(async () => {
      const res = await fetch(startPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(extraConfig),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to start session.");
        return;
      }
      const { sessionId, runnerPath } = await res.json();
      router.push(runnerPath ?? `${startHref}/${sessionId}`);
    });
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft"
      >
        <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-primary/15 grid place-items-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline" className="capitalize">
              {mode} mode
            </Badge>
          </div>
          <h1 className="mt-5 font-serif text-5xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-3 text-lg text-ink-muted max-w-2xl">{blurb}</p>

          <div className="mt-8 flex flex-wrap items-center gap-6 text-sm">
            <Stat label="Questions" value={String(questionCount)} />
            {typeof durationMin === "number" && (
              <Stat
                label="Time limit"
                value={`${durationMin} min`}
                icon={<Clock className="h-3.5 w-3.5" />}
              />
            )}
            {typeof passPct === "number" && (
              <Stat label="Passing" value={`${passPct}%`} />
            )}
          </div>

          <div className="mt-8 flex items-center gap-3">
            <Button size="lg" onClick={begin} disabled={pending || disabled}>
              {pending ? "Starting…" : "Start now"} <ArrowRight className="h-4 w-4" />
            </Button>
            {disabled && disabledReason && (
              <span className="text-sm text-ink-muted">{disabledReason}</span>
            )}
          </div>
        </div>
      </motion.div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">How this mode works</h3>
          <ul className="space-y-2.5 text-sm text-ink-muted">
            {bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-2 h-1 w-1 rounded-full bg-primary shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-9 w-9 rounded-xl bg-elevated grid place-items-center text-ink-muted">
        {icon ?? <span className="font-serif text-sm">#</span>}
      </div>
      <div>
        <div className="text-xs text-ink-muted">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
