"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, ListTodo, Beaker, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MISTAKES_TOTAL, MISTAKES_SMOKE_TOTAL } from "@/lib/mistakes/pick-questions";

type Length = "full" | "smoke";

type Props = {
  unresolvedMistakeCount: number;
};

export function MistakesStartPicker({ unresolvedMistakeCount }: Props) {
  const router = useRouter();
  const [length, setLength] = React.useState<Length>("full");
  const [busy, setBusy] = React.useState(false);
  const inFlight = React.useRef(false);

  const total = length === "smoke" ? MISTAKES_SMOKE_TOTAL : MISTAKES_TOTAL;
  const cappedMistakes = Math.min(unresolvedMistakeCount, total);
  const fillerPreview = Math.max(0, total - cappedMistakes);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await fetch("/mistakes/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ length }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to start Mistakes Test.");
        return;
      }
      const { runnerPath, sessionId } = await res.json();
      router.push(runnerPath ?? `/mistakes/${sessionId}`);
    } catch (e) {
      console.error(e);
      toast.error("Network error — try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const OPTIONS: Array<{
    id: Length;
    label: string;
    count: number;
    estMin: string;
    blurb: string;
    bullets: string[];
    badge?: string;
  }> = [
    {
      id: "full",
      label: "Full Mistakes Test",
      count: MISTAKES_TOTAL,
      estMin: "~60–90 min",
      blurb:
        "Every unresolved miss (up to 110), then weighted medium + hard filler to mirror the exam. Same sibling-on-miss flow.",
      bullets: [
        "Mistakes first, hardest misses prioritized",
        "National / state filler weighted to weak sections",
        "Harder AI sibling on every miss",
      ],
      badge: "Exam-shaped",
    },
    {
      id: "smoke",
      label: "Smoke test (10)",
      count: MISTAKES_SMOKE_TOTAL,
      estMin: "~5–10 min",
      blurb:
        "Same picker and provenance chips as the full run — just 10 questions. Use this before a mock exam to sanity-check the flow.",
      bullets: [
        "Same logic as 110, scaled down",
        "Origin chips: where you first missed it, or New",
        "Good for quick QA",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft">
        <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-primary/15 grid place-items-center">
              <ListTodo className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline" className="capitalize">
              Mistakes Test
            </Badge>
          </div>
          <h1 className="mt-5 font-serif text-5xl font-semibold tracking-tight">
            Re-drill the ones that got away.
          </h1>
          <p className="mt-3 text-lg text-ink-muted max-w-2xl">
            You have{" "}
            <span className="font-medium text-ink">{unresolvedMistakeCount}</span>{" "}
            unresolved mistake
            {unresolvedMistakeCount === 1 ? "" : "s"} in your pool. Pick a length
            — same algorithm, different size.
          </p>

          <div className="mt-4 rounded-2xl border border-border bg-elevated/60 px-4 py-3 text-sm text-ink-muted">
            <span className="font-medium text-ink">Preview for selected length:</span>{" "}
            up to {cappedMistakes} from your pool
            {fillerPreview > 0 ? ` + ${fillerPreview} weighted new` : ""} ={" "}
            <span className="font-medium text-ink">{total}</span> questions.
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {OPTIONS.map((opt) => {
              const active = length === opt.id;
              const Icon = opt.id === "full" ? ListTodo : Beaker;
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

          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <Button size="lg" onClick={start} disabled={busy}>
              {busy
                ? "Starting…"
                : length === "smoke"
                  ? "Start 10-question smoke test"
                  : "Start full 110-question Mistakes Test"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">How Mistakes Test works</h3>
          <ul className="space-y-2.5 text-sm text-ink-muted">
            {[
              "Pass 1 fills from your unresolved mistake pool (assessment + practice soft/hard misses).",
              "Pass 2 tops up with medium + hard bank questions, national/state weighted like the real exam, weak sections get more.",
              "Each card shows where you first missed it — or New for filler.",
              "Miss one? A harder same-concept sibling appears — extra try, not counted toward your session total.",
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
