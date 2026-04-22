"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Target,
  Zap,
  Telescope,
  CheckCircle2,
  Lightbulb,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Section = {
  code: string;
  title: string;
  group: "National" | "State";
  count: number;
};

type Length = "quick" | "deep" | "smoke";

const LENGTH_PER_SECTION: Record<Length, number> = {
  quick: 15,
  deep: 35,
  smoke: 2,
};

export function AssessmentPicker({ sections }: { sections: Section[] }) {
  const router = useRouter();
  const [length, setLength] = React.useState<Length>("quick");
  const [picked, setPicked] = React.useState<Set<string>>(
    () => new Set(sections.filter((s) => s.count > 0).map((s) => s.code)),
  );
  const [pending, setPending] = React.useState(false);

  const eligible = sections.filter((s) => s.count > 0);
  const allSelected = picked.size === eligible.length;
  const totalQuestions = picked.size * LENGTH_PER_SECTION[length];

  function togglePick(code: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }
  function toggleAll() {
    if (allSelected) setPicked(new Set());
    else setPicked(new Set(eligible.map((s) => s.code)));
  }
  function pickGroup(group: "National" | "State") {
    setPicked(new Set(eligible.filter((s) => s.group === group).map((s) => s.code)));
  }

  async function start() {
    if (!picked.size) {
      toast.error("Pick at least one section.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/assessment/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          length,
          sections: Array.from(picked),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start.");
      router.push(json.runnerPath);
    } catch (e) {
      toast.error((e as Error).message);
      setPending(false);
    }
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
              <Target className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline">Assessment</Badge>
          </div>
          <h1 className="mt-5 font-serif text-5xl font-semibold tracking-tight">
            Find out where you stand.
          </h1>
          <p className="mt-3 text-lg text-ink-muted max-w-2xl">
            We&apos;ll measure each section you pick — easy, medium, and hard
            mixed. Get one wrong? You&apos;ll see a hint and one more chance.
            Your answers (mastered, lucky, soft miss, hard miss) shape every
            study mode that follows.
          </p>
        </div>
      </motion.div>

      {/* Length selector */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">1. How deep do you want to go?</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <LengthOption
              label="Quick check"
              minutes="~20 min"
              detail={`15 questions × selected sections (${15 * picked.size} total)`}
              icon={<Zap className="h-4 w-4" />}
              active={length === "quick"}
              onClick={() => setLength("quick")}
            />
            <LengthOption
              label="Deep diagnostic"
              minutes="~60 min"
              detail={`35 questions × selected sections (${35 * picked.size} total)`}
              icon={<Telescope className="h-4 w-4" />}
              active={length === "deep"}
              onClick={() => setLength("deep")}
            />
            <LengthOption
              label="Smoke test"
              minutes="~2 min / section"
              detail={`2 questions × selected sections (${2 * picked.size} total) — for testing flows, hints, and results.`}
              icon={<FlaskConical className="h-4 w-4" />}
              active={length === "smoke"}
              onClick={() => setLength("smoke")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section picker */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h3 className="font-semibold">2. Which sections?</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => pickGroup("National")}>
                National only
              </Button>
              <Button size="sm" variant="ghost" onClick={() => pickGroup("State")}>
                SC only
              </Button>
              <Button size="sm" variant="outline" onClick={toggleAll}>
                {allSelected ? "Clear all" : "Select all"}
              </Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sections.map((s) => {
              const disabled = s.count === 0;
              const active = picked.has(s.code);
              return (
                <button
                  key={s.code}
                  type="button"
                  disabled={disabled}
                  onClick={() => togglePick(s.code)}
                  className={cn(
                    "group relative text-left rounded-2xl border p-3 transition-all focus-ring",
                    "flex items-center gap-3",
                    disabled && "opacity-40 cursor-not-allowed",
                    !disabled && active && "border-primary bg-primary-soft/40",
                    !disabled && !active && "border-border bg-surface hover:bg-elevated",
                  )}
                >
                  <div
                    className={cn(
                      "h-9 w-9 rounded-xl grid place-items-center text-sm font-semibold border shrink-0",
                      active
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "bg-muted text-ink-muted border-border",
                    )}
                  >
                    {s.code}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">
                      {s.title}
                    </div>
                    <div className="text-xs text-ink-muted">
                      {s.group} · {s.count.toLocaleString()} questions
                    </div>
                  </div>
                  {active && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-warn" /> How the 2-chance flow works
          </h3>
          <ul className="space-y-2.5 text-sm text-ink-muted">
            <li className="flex gap-2"><Dot /> First try right (no hint) → <b className="text-success">mastered</b>.</li>
            <li className="flex gap-2"><Dot /> First try right (after hint) → <b className="text-warn">lucky</b>. We&apos;ll re-test the concept.</li>
            <li className="flex gap-2"><Dot /> Second try right after a wrong → <b className="text-warn">soft miss</b>. Reachable.</li>
            <li className="flex gap-2"><Dot /> Wrong twice → <b className="text-danger">hard miss</b>. We&apos;ll teach this from scratch.</li>
            <li className="flex gap-2"><Dot /> No section is auto-revealed. Hints come from AI, tailored to the question.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Sticky footer summary */}
      <div className="sticky bottom-4 z-20">
        <div className="rounded-2xl border border-border bg-surface/95 backdrop-blur p-4 shadow-soft flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <div className="font-medium text-ink">
              {picked.size} section{picked.size === 1 ? "" : "s"} ·{" "}
              {totalQuestions.toLocaleString()} questions
            </div>
            <div className="text-ink-muted text-xs">
              ≈ {Math.round((totalQuestions * 60) / 60)} minutes at 60 sec / question
            </div>
          </div>
          <Button size="lg" onClick={start} disabled={pending || !picked.size}>
            {pending ? "Building your set…" : "Start assessment"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="mt-2 h-1 w-1 rounded-full bg-primary shrink-0" />;
}

function LengthOption({
  label,
  minutes,
  detail,
  icon,
  active,
  onClick,
}: {
  label: string;
  minutes: string;
  detail: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-2xl border p-4 transition-all focus-ring",
        active
          ? "border-primary bg-primary-soft/40 shadow-soft"
          : "border-border bg-surface hover:bg-elevated",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-ink">
          <span
            className={cn(
              "h-7 w-7 rounded-lg grid place-items-center",
              active ? "bg-primary text-primary-foreground" : "bg-muted text-ink-muted",
            )}
          >
            {icon}
          </span>
          {label}
        </div>
        <span className="text-xs text-ink-muted">{minutes}</span>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{detail}</p>
    </button>
  );
}
