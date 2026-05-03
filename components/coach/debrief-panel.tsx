"use client";

import * as React from "react";
import { useChat } from "ai/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Sparkles,
  Send,
  Loader2,
  ArrowRight,
  Target,
  ChevronDown,
  CheckCircle2,
  Wand2,
  RotateCcw,
  X,
  ShieldAlert,
  BookOpen,
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { SECTIONS, type SectionCode } from "@/lib/constants";
import {
  type DebriefPlan,
  DEFAULT_PLAN,
  sanitizePlan,
} from "@/lib/coach/debrief-plan";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";

/* ------------------------------ Types & props ----------------------------- */

type Snapshot = {
  mode: "assessment" | "practice" | "mistakes" | "mock" | "final";
  sessionId: string;
  total: number;
  correct: number;
  accuracy: number;
  passBar?: number | null;
  durationMs?: number | null;
  hintUsed?: number | null;
  coachedPct?: number | null;
  bySection: {
    code: string;
    title?: string;
    total: number;
    correct: number;
    accuracy?: number | null;
    baselineAccuracy?: number | null;
  }[];
  weakestCodes: string[];
  strongestCodes: string[];
  prior?: { label: string; accuracy?: number | null } | null;
};

type Props = {
  snapshot: Snapshot;
  initialPlan?: DebriefPlan | null;
  initialCommitted?: boolean;
};

const SECTION_GROUP: Record<string, "National" | "State"> = Object.fromEntries(
  SECTIONS.map((s) => [s.code, s.group as "National" | "State"]),
);

/* --------------------------- Plan extraction util ------------------------- */

type ToolInvocation = {
  toolName: string;
  state?: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
};

type MessagePart =
  | { type: "text"; text: string }
  | { type: "tool-invocation"; toolInvocation: ToolInvocation }
  | { type: string; [key: string]: unknown };

function extractPlanFromMessages(messages: Array<{ parts?: MessagePart[] }>): {
  plan: DebriefPlan | null;
  committed: boolean;
} {
  let plan: DebriefPlan | null = null;
  let committed = false;
  for (const m of messages) {
    for (const p of m.parts ?? []) {
      if (p.type === "tool-invocation") {
        const inv = (p as { toolInvocation: ToolInvocation }).toolInvocation;
        if (!inv) continue;
        const data = (inv.result ?? inv.args) as Record<string, unknown> | undefined;
        if (!data) continue;
        if (inv.toolName === "propose_plan" || inv.toolName === "commit_plan") {
          plan = sanitizePlan(data as Partial<DebriefPlan>);
          if (inv.toolName === "commit_plan") committed = true;
        }
      }
    }
  }
  return { plan, committed };
}

/* -------------------------------- Component ------------------------------- */

export function DebriefPanel({ snapshot, initialPlan, initialCommitted }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState<boolean>(!initialPlan);
  const [plan, setPlan] = React.useState<DebriefPlan>(
    initialPlan ? sanitizePlan(initialPlan) : { ...DEFAULT_PLAN },
  );
  const [committed, setCommitted] = React.useState<boolean>(!!initialCommitted);
  const [dirtySinceSave, setDirtySinceSave] = React.useState(false);
  const [starting, setStarting] = React.useState(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    setInput,
    append,
  } = useChat({
    api: "/api/coach/debrief",
    body: { snapshot },
  });

  // Sync the plan state whenever the model emits a plan tool call.
  React.useEffect(() => {
    const { plan: p, committed: c } = extractPlanFromMessages(
      messages as unknown as Array<{ parts?: MessagePart[] }>,
    );
    if (p) {
      setPlan(p);
      if (c) setCommitted(true);
      setDirtySinceSave(true);
    }
  }, [messages]);

  // Seed an opening message automatically when the panel first opens.
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (!open || seededRef.current) return;
    if (messages.length > 0) {
      seededRef.current = true;
      return;
    }
    seededRef.current = true;
    append({
      role: "user",
      content:
        "Let's debrief. Give me one honest read on this run, then ask me a question that will help us plan what to do next.",
    });
  }, [open, messages.length, append]);

  // Save plan to session config whenever it changes (debounced via the
  // `dirtySinceSave` flag driven by tool calls or manual edits).
  React.useEffect(() => {
    if (!dirtySinceSave) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        await fetch("/api/coach/debrief/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: snapshot.sessionId,
            plan,
            committed,
          }),
          signal: controller.signal,
        });
        setDirtySinceSave(false);
      } catch {
        // swallow — we'll retry on next change
      }
    }, 450);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [plan, committed, dirtySinceSave, snapshot.sessionId]);

  function toggleFocus(code: string) {
    setPlan((p) => {
      const focus = new Set(p.focus ?? []);
      const avoid = new Set(p.avoid ?? []);
      if (focus.has(code)) focus.delete(code);
      else {
        focus.add(code);
        avoid.delete(code);
      }
      return { ...p, focus: [...focus], avoid: [...avoid] };
    });
    setDirtySinceSave(true);
  }

  function toggleAvoid(code: string) {
    setPlan((p) => {
      const focus = new Set(p.focus ?? []);
      const avoid = new Set(p.avoid ?? []);
      if (avoid.has(code)) avoid.delete(code);
      else {
        avoid.add(code);
        focus.delete(code);
      }
      return { ...p, focus: [...focus], avoid: [...avoid] };
    });
    setDirtySinceSave(true);
  }

  function setTotal(n: number) {
    setPlan((p) => ({ ...p, total: Math.max(10, Math.min(110, Math.round(n))) }));
    setDirtySinceSave(true);
  }

  function setBias(bias: DebriefPlan["difficultyBias"]) {
    setPlan((p) => ({ ...p, difficultyBias: bias }));
    setDirtySinceSave(true);
  }

  function resetPlan() {
    setPlan({ ...DEFAULT_PLAN, focus: snapshot.weakestCodes.slice(0, 3) });
    setCommitted(false);
    setDirtySinceSave(true);
  }

  async function startPractice() {
    setStarting(true);
    try {
      const res = await fetch("/practice/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          length: "custom",
          plan,
          fromSessionId: snapshot.sessionId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to start practice.");
        return;
      }
      const { runnerPath, sessionId } = await res.json();
      router.push(runnerPath ?? `/practice/${sessionId}`);
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setStarting(false);
    }
  }

  const suggestions = buildSuggestionChips(snapshot);
  const focusSet = new Set(plan.focus ?? []);
  const avoidSet = new Set(plan.avoid ?? []);
  const preview = previewAllocation(plan, snapshot);

  /* ----------------------------- COLLAPSED VIEW --------------------------- */

  if (!open) {
    return (
      <Launcher
        snapshot={snapshot}
        plan={plan}
        committed={committed}
        onOpen={() => setOpen(true)}
        onStart={startPractice}
        starting={starting}
      />
    );
  }

  /* ----------------------------- EXPANDED VIEW ---------------------------- */

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative flex h-[min(92dvh,900px)] max-h-[94dvh] min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-surface to-surface shadow-soft"
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl"
      />

      {/* Header */}
      <div className="relative flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-md animate-pulse" />
            <div className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 grid place-items-center shadow-glow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Coach debrief</h3>
              <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Live
              </Badge>
            </div>
            <p className="text-xs text-ink-muted">
              A short conversation to lock in what’s next — you can customize and I’ll actually use it.
            </p>
          </div>
        </div>
        <button
          aria-label="Minimize"
          onClick={() => setOpen(false)}
          className="text-ink-muted hover:text-ink p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body — split: chat + plan (bounded height so composer + CTAs stay in view) */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[1.15fr_1fr] lg:gap-0">
        {/* Chat column */}
        <div className="flex min-h-0 flex-[1.15] basis-0 flex-col border-b border-border/60 lg:h-full lg:max-h-full lg:flex-none lg:border-b-0 lg:border-r">
          <ChatStream
            messages={messages as unknown as Array<{ id: string; role: string; parts?: MessagePart[]; content?: string }>}
            isLoading={isLoading}
          />
          <div className="shrink-0 border-t border-border/60 bg-surface/90 px-5 py-3 backdrop-blur-sm sm:px-6">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-ink-muted hover:border-primary/50 hover:text-ink transition-colors"
                  onClick={() => setInput(s)}
                >
                  {s}
                </button>
              ))}
              {messages.length > 0 && (
                <button
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-ink-muted hover:text-ink inline-flex items-center gap-1"
                  onClick={() => {
                    setMessages([]);
                    seededRef.current = false;
                  }}
                  aria-label="Restart conversation"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restart
                </button>
              )}
            </div>
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                  }
                }}
                placeholder="Tell the coach how it felt, or what you want more of…"
                rows={1}
                className="flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>

        {/* Plan column — scroll controls; CTAs pinned at bottom */}
        <div className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden bg-surface/40 lg:h-full lg:flex-none">
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
            <PlanHeader
              plan={plan}
              committed={committed}
              onReset={resetPlan}
            />
            <PlanTotalControl total={plan.total ?? 30} onChange={setTotal} />
            <PlanDifficulty bias={plan.difficultyBias ?? "mix"} onChange={setBias} />
            <PlanSections
              focusSet={focusSet}
              avoidSet={avoidSet}
              weakest={snapshot.weakestCodes}
              onToggleFocus={toggleFocus}
              onToggleAvoid={toggleAvoid}
            />
            <PlanPreview preview={preview} total={plan.total ?? 30} />
          </div>
          <div className="shrink-0 border-t border-border/60 bg-surface/95 px-5 py-4 backdrop-blur-sm sm:px-6">
            <AnimatePresence mode="wait">
              {committed ? (
                <motion.div
                  key="cta-committed"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Button
                    size="lg"
                    className="w-full text-base"
                    onClick={startPractice}
                    disabled={starting}
                  >
                    {starting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Start practice with this plan
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="cta-preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-2"
                >
                  <Button
                    size="lg"
                    variant="soft"
                    className="w-full text-base"
                    onClick={() => {
                      setCommitted(true);
                      setDirtySinceSave(true);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Lock in this plan
                  </Button>
                  <p className="text-center text-[11px] text-ink-muted">
                    Keep chatting to refine — or lock it in and launch practice.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ------------------------------- Launcher --------------------------------- */

function Launcher({
  snapshot,
  plan,
  committed,
  onOpen,
  onStart,
  starting,
}: {
  snapshot: Snapshot;
  plan: DebriefPlan;
  committed: boolean;
  onOpen: () => void;
  onStart: () => void;
  starting: boolean;
}) {
  const focus = (plan.focus ?? []).slice(0, 4);
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-surface to-surface p-5 sm:p-6 shadow-soft"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-12 h-56 w-56 rounded-full bg-primary/30 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-md animate-pulse" />
            <div className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 grid place-items-center shadow-glow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold">Your coach has a plan ready</h3>
            <p className="text-sm text-ink-muted max-w-prose">
              {plan.note?.trim()
                ? plan.note
                : `Based on this run (${Math.round(snapshot.accuracy)}%), I can build your next practice to hit the right sections. Want to talk it through?`}
            </p>
            {focus.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {focus.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary font-medium"
                  >
                    Focus {c}
                  </span>
                ))}
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-ink-muted">
                  {plan.total ?? 30} questions
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {committed ? (
            <Button size="lg" onClick={onStart} disabled={starting}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Start practice <ArrowRight className="h-4 w-4" /></>}
            </Button>
          ) : (
            <Button size="lg" onClick={onOpen}>
              Talk with coach
              <Sparkles className="h-4 w-4" />
            </Button>
          )}
          <Button size="lg" variant="outline" onClick={onOpen}>
            {committed ? "Adjust plan" : "See plan"}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.section>
  );
}

/* ------------------------------ Chat stream ------------------------------- */

function ChatStream({
  messages,
  isLoading,
}: {
  messages: Array<{ id: string; role: string; parts?: MessagePart[]; content?: string }>;
  isLoading: boolean;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  return (
    <div
      ref={scrollerRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain thin-scroll px-5 py-4 sm:px-6 space-y-3"
    >
      {messages.length === 0 && (
        <div className="text-sm text-ink-muted">
          Starting the conversation…
        </div>
      )}
      {messages.map((m) => {
        const parts = m.parts ?? (m.content ? [{ type: "text", text: m.content } as MessagePart] : []);
        const isUser = m.role === "user";
        return (
          <div
            key={m.id}
            className={cn("flex", isUser ? "justify-end" : "justify-start")}
          >
            <div className={cn("max-w-[92%] space-y-2", isUser ? "items-end" : "items-start")}>
              {parts.map((p, i) => {
                if (p.type === "text") {
                  const text = (p as { text: string }).text;
                  if (!text?.trim()) return null;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        isUser
                          ? "whitespace-pre-wrap bg-primary text-primary-foreground"
                          : "bg-surface border border-border text-ink",
                      )}
                    >
                      {isUser ? text : <ChatMarkdown content={text} />}
                    </div>
                  );
                }
                if (p.type === "tool-invocation") {
                  const inv = (p as { toolInvocation: ToolInvocation }).toolInvocation;
                  if (!inv) return null;
                  const data = (inv.result ?? inv.args) as DebriefPlan | undefined;
                  if (!data) return null;
                  const committed = inv.toolName === "commit_plan";
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-2xl border px-3.5 py-2.5 text-xs",
                        committed
                          ? "border-emerald-400/50 bg-emerald-500/10 text-ink"
                          : "border-primary/40 bg-primary/10 text-ink",
                      )}
                    >
                      <div className="mb-1 flex items-center gap-1.5 font-semibold">
                        {committed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Wand2 className="h-3.5 w-3.5 text-primary" />
                        )}
                        {committed ? "Plan locked in" : "Proposed plan"}
                      </div>
                      <div className="text-ink-muted">
                        {data.total ?? 30} questions
                        {data.difficultyBias && data.difficultyBias !== "mix"
                          ? ` · ${data.difficultyBias}`
                          : ""}
                      </div>
                      {(data.focus ?? []).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(data.focus ?? []).map((c) => (
                            <span
                              key={c}
                              className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary"
                            >
                              +{c}
                            </span>
                          ))}
                          {(data.avoid ?? []).map((c) => (
                            <span
                              key={c}
                              className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-500"
                            >
                              −{c}
                            </span>
                          ))}
                        </div>
                      )}
                      {data.note && (
                        <div className="mt-1.5 text-[11px] italic text-ink-muted">
                          “{data.note}”
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        );
      })}
      {isLoading && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-surface border border-border px-3.5 py-2 text-sm flex items-center gap-1.5 text-ink-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.2s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.1s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Plan UI --------------------------------- */

function PlanHeader({
  plan,
  committed,
  onReset,
}: {
  plan: DebriefPlan;
  committed: boolean;
  onReset: () => void;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          <Target className="h-3.5 w-3.5" />
          Your next plan
          {committed && (
            <Badge variant="outline" className="ml-1 gap-1 border-emerald-400/40 bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              Locked
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-sm text-ink">
          {plan.note?.trim()
            ? plan.note
            : "Tweak anything below — the coach will use this for your next practice."}
        </div>
      </div>
      <button
        onClick={onReset}
        className="text-[11px] text-ink-muted hover:text-ink inline-flex items-center gap-1"
      >
        <RotateCcw className="h-3 w-3" />
        Reset
      </button>
    </div>
  );
}

function PlanTotalControl({
  total,
  onChange,
}: {
  total: number;
  onChange: (n: number) => void;
}) {
  const presets = [10, 20, 30, 50, 110];
  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">Length</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange(total - 5)}
            className="h-7 w-7 grid place-items-center rounded-full border border-border text-ink-muted hover:text-ink"
            aria-label="Decrease"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-[64px] text-center text-lg font-semibold tabular-nums">{total}</div>
          <button
            onClick={() => onChange(total + 5)}
            className="h-7 w-7 grid place-items-center rounded-full border border-border text-ink-muted hover:text-ink"
            aria-label="Increase"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              total === p
                ? "bg-primary text-primary-foreground"
                : "border border-border text-ink-muted hover:text-ink",
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanDifficulty({
  bias,
  onChange,
}: {
  bias: NonNullable<DebriefPlan["difficultyBias"]>;
  onChange: (b: DebriefPlan["difficultyBias"]) => void;
}) {
  const opts: { value: NonNullable<DebriefPlan["difficultyBias"]>; label: string; blurb: string }[] = [
    { value: "mix", label: "Balanced", blurb: "Weakness-tuned mix" },
    { value: "harder", label: "Harder", blurb: "More hard items" },
    { value: "review", label: "Review", blurb: "Easier recovery" },
  ];
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-xs font-medium text-ink-muted">Difficulty bias</div>
      <div className="grid grid-cols-3 gap-1.5">
        {opts.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-xl border px-2 py-2 text-left transition-colors",
              bias === o.value
                ? "border-primary/60 bg-primary/10"
                : "border-border hover:bg-elevated",
            )}
          >
            <div className="text-xs font-semibold">{o.label}</div>
            <div className="text-[10px] text-ink-muted">{o.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanSections({
  focusSet,
  avoidSet,
  weakest,
  onToggleFocus,
  onToggleAvoid,
}: {
  focusSet: Set<string>;
  avoidSet: Set<string>;
  weakest: string[];
  onToggleFocus: (c: string) => void;
  onToggleAvoid: (c: string) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-xs font-medium text-ink-muted">Sections</div>
        <div className="flex items-center gap-2 text-[10px] text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> focus
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> avoid
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {SECTIONS.map((s) => {
          const isFocus = focusSet.has(s.code);
          const isAvoid = avoidSet.has(s.code);
          const isWeak = weakest.includes(s.code);
          return (
            <div
              key={s.code}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-xs transition-colors",
                isFocus
                  ? "border-primary/60 bg-primary/10"
                  : isAvoid
                    ? "border-rose-500/40 bg-rose-500/5"
                    : "border-border bg-surface",
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold tabular-nums">{s.code}</span>
                  {isWeak && (
                    <span className="rounded bg-amber-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-600">
                      weak
                    </span>
                  )}
                </div>
                <span className="truncate text-[10px] text-ink-muted">{s.title}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onToggleFocus(s.code)}
                  title="Focus on this section"
                  className={cn(
                    "h-6 w-6 grid place-items-center rounded-full border transition-colors",
                    isFocus
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-ink-muted hover:border-primary/50 hover:text-primary",
                  )}
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onToggleAvoid(s.code)}
                  title="Downweight this section"
                  className={cn(
                    "h-6 w-6 grid place-items-center rounded-full border transition-colors",
                    isAvoid
                      ? "border-rose-500 bg-rose-500 text-white"
                      : "border-border text-ink-muted hover:border-rose-400/50 hover:text-rose-500",
                  )}
                >
                  <Minus className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanPreview({
  preview,
  total,
}: {
  preview: { code: string; count: number; focus: boolean; avoid: boolean }[];
  total: number;
}) {
  const max = Math.max(1, ...preview.map((p) => p.count));
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          Estimated distribution
        </span>
        <span className="tabular-nums">{total}q</span>
      </div>
      <div className="space-y-1">
        {preview.map((row) => (
          <div key={row.code} className="flex items-center gap-2 min-w-0">
            <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-ink-muted">
              {formatSectionDisplayLabel(row.code)}
            </span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
              <motion.div
                initial={false}
                animate={{ width: `${(row.count / max) * 100}%` }}
                transition={{ type: "spring", stiffness: 140, damping: 22 }}
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  row.focus
                    ? "bg-primary"
                    : row.avoid
                      ? "bg-rose-400/70"
                      : "bg-ink-muted/60",
                )}
              />
            </div>
            <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-ink-muted">
              {row.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Support helpers ---------------------------- */

function buildSuggestionChips(s: Snapshot): string[] {
  const weakest = s.weakestCodes[0];
  const chips: string[] = [];
  if (weakest) chips.push(`Drill ${weakest} more`);
  chips.push("Make it shorter");
  chips.push("Make it harder");
  chips.push("Why did I miss these?");
  if (s.strongestCodes[0]) chips.push(`Skip ${s.strongestCodes[0]}`);
  return chips.slice(0, 5);
}

/**
 * Lightweight, client-side allocation preview mirroring the server's
 * weakness/weight logic without async Supabase calls. This is only a UI
 * preview — the server still runs the canonical allocator.
 */
function previewAllocation(
  plan: DebriefPlan,
  snapshot: Snapshot,
): { code: SectionCode; count: number; focus: boolean; avoid: boolean }[] {
  const total = Math.max(10, plan.total ?? 30);
  const nationalTarget = Math.round(total * (80 / 120));
  const stateTarget = total - nationalTarget;

  const focus = new Set(plan.focus ?? []);
  const avoid = new Set(plan.avoid ?? []);

  const accBy = new Map<string, number>();
  for (const r of snapshot.bySection ?? []) {
    if (r.accuracy != null) accBy.set(r.code, r.accuracy);
  }

  function weight(code: string) {
    const acc = accBy.get(code);
    const base = acc == null ? 0.92 : Math.pow(1 - acc / 100 + 0.04, 1.75) + 0.08;
    const mult = focus.has(code) ? 2.0 : avoid.has(code) ? 0.4 : 1;
    return base * mult;
  }

  function allocate(codes: readonly string[], pool: number, minPer: number) {
    const counts = new Map<string, number>();
    for (const c of codes) counts.set(c, Math.min(pool, focus.has(c) && total >= 15 ? Math.max(minPer, 4) : minPer));
    let left = pool - Array.from(counts.values()).reduce((a, b) => a + b, 0);
    while (left > 0) {
      let best = codes[0];
      let score = -Infinity;
      for (const c of codes) {
        const w = weight(c);
        const s = w / ((counts.get(c) ?? 0) + 1);
        if (s > score) {
          score = s;
          best = c;
        }
      }
      counts.set(best, (counts.get(best) ?? 0) + 1);
      left--;
    }
    return counts;
  }

  const nationalCodes = SECTIONS.filter((s) => s.group === "National").map((s) => s.code);
  const stateCodes = SECTIONS.filter((s) => s.group === "State").map((s) => s.code);
  const nationalMin = total >= 60 ? 2 : 0;
  const stateMin = total >= 60 ? 1 : 0;

  const nCounts = allocate(nationalCodes, nationalTarget, nationalMin);
  const sCounts = allocate(stateCodes, stateTarget, stateMin);

  return SECTIONS.map((s) => ({
    code: s.code,
    count: (SECTION_GROUP[s.code] === "National" ? nCounts.get(s.code) : sCounts.get(s.code)) ?? 0,
    focus: focus.has(s.code),
    avoid: avoid.has(s.code),
  }));
}

/* Silence unused import warning if ShieldAlert isn't referenced above. */
void ShieldAlert;
