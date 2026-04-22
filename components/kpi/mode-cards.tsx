"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Target, Brain, ListTodo, Timer, Trophy, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    href: "/assessment",
    icon: Target,
    title: "Assessment",
    blurb: "Diagnose where you stand in 15 minutes.",
    color: "from-primary/20 to-primary-soft/30",
  },
  {
    href: "/practice",
    icon: Brain,
    title: "Practice",
    blurb: "110 questions with hints and retries.",
    color: "from-primary/15 to-accent/30",
  },
  {
    href: "/mistakes",
    icon: ListTodo,
    title: "Mistakes",
    blurb: "Re-drill questions you got wrong.",
    color: "from-warn/15 to-primary-soft/30",
  },
  {
    href: "/mock-exam",
    icon: Timer,
    title: "Mock Exam",
    blurb: "Adaptive 120Q / 240 min. Mistakes weigh most.",
    color: "from-ink/10 to-primary/10",
  },
  {
    href: "/final-test",
    icon: Trophy,
    title: "Final Test",
    blurb: "Held-out questions. True readiness.",
    color: "from-success/15 to-primary-soft/20",
  },
];

export function ModeCards() {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
      {ITEMS.map((it, i) => {
        const Icon = it.icon;
        return (
          <motion.div
            key={it.href}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
          >
            <Link
              href={it.href}
              className={cn(
                "group relative flex flex-col gap-3 h-full rounded-2xl border border-border bg-surface p-4 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-soft",
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity",
                  "bg-gradient-to-br",
                  it.color,
                )}
                aria-hidden
              />
              <div className="relative flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-primary-soft/60 grid place-items-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <ArrowRight className="h-4 w-4 text-ink-muted -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
              </div>
              <div className="relative">
                <div className="font-serif text-lg font-semibold text-ink">
                  {it.title}
                </div>
                <div className="text-xs text-ink-muted mt-0.5">{it.blurb}</div>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
