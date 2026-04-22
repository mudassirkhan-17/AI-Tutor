"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Brain, Beaker, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Length = "full" | "smoke";

const OPTIONS: Array<{
  id: Length;
  label: string;
  count: number;
  estMin: string;
  blurb: string;
  bullets: string[];
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}> = [
  {
    id: "full",
    label: "Full practice",
    count: 110,
    estMin: "~70–90 min",
    blurb:
      "The real run. National + state in exam ratio, weighted to your weak sections, harder concepts surfaced more.",
    bullets: [
      "~73 national + ~37 state",
      "Weak sections get more questions",
      "Difficulty mix tuned per section",
    ],
    icon: Brain,
    badge: "Recommended",
  },
  {
    id: "smoke",
    label: "Smoke test",
    count: 10,
    estMin: "~5–8 min",
    blurb:
      "Same picker, same sibling-on-miss flow — just 10 questions so you can verify the loop end-to-end and unlock Mistakes.",
    bullets: [
      "Same allocation logic, scaled down",
      "Counts toward unlocking Mistakes (8 of 10)",
      "Use this for fast QA",
    ],
    icon: Beaker,
  },
];

export function PracticeStartPicker() {
  const router = useRouter();
  const [length, setLength] = React.useState<Length>("full");
  const [busy, setBusy] = React.useState(false);
  const inFlight = React.useRef(false);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await fetch("/practice/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ length }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to start practice.");
        return;
      }
      const { runnerPath, sessionId } = await res.json();
      router.push(runnerPath ?? `/practice/${sessionId}`);
    } catch (e) {
      console.error(e);
      toast.error("Network error — try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft">
        <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-primary/15 grid place-items-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline" className="capitalize">
              Practice mode
            </Badge>
          </div>
          <h1 className="mt-5 font-serif text-5xl font-semibold tracking-tight">
            Practice. Hint. Retry. Master.
          </h1>
          <p className="mt-3 text-lg text-ink-muted max-w-2xl">
            Adaptive question allocation, AI sibling on every miss. Pick a
            length to get started.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {OPTIONS.map((opt) => {
              const active = length === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLength(opt.id)}
                  className={cn(
                    "text-left rounded-2xl border p-5 transition-all focus-ring",
                    active
                      ? "border-primary bg-primary-soft/40 shadow-soft"
                      : "border-border bg-surface hover:border-primary/50",
                  )}
                  aria-pressed={active}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-9 w-9 rounded-xl grid place-items-center",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-ink-muted",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-ink">{opt.label}</div>
                        <div className="text-xs text-ink-muted">
                          {opt.count} questions · {opt.estMin}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {opt.badge && (
                        <Badge variant="outline" className="text-[10px]">
                          {opt.badge}
                        </Badge>
                      )}
                      {active && (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-ink-muted leading-relaxed">
                    {opt.blurb}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
                    {opt.bullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center gap-3">
            <Button size="lg" onClick={start} disabled={busy}>
              {busy
                ? "Starting…"
                : length === "smoke"
                  ? "Start 10-question smoke test"
                  : "Start full 110-question practice"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            {length === "smoke" && (
              <span className="text-xs text-ink-muted">
                Quickest path to test the Mistakes Test flow.
              </span>
            )}
          </div>
        </div>
      </section>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">How practice works</h3>
          <ul className="space-y-2.5 text-sm text-ink-muted">
            {[
              "Question count and per-section allocation use the same logic in both modes — smoke just scales it down.",
              "Miss a question? The tutor AI writes a fresh same-concept question right away as a free extra try (doesn't count toward total).",
              "Mistakes Test unlocks when you finish a practice run (≥80% of its questions answered).",
              "All attempts and AI siblings are stored so future Practice + Mistakes runs adapt to you.",
            ].map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {b}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
