"use client";

import { motion } from "framer-motion";

export function ReadinessRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const size = 160;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;

  const verdict =
    v >= 85 ? "Ready to test" : v >= 70 ? "Almost there" : v >= 50 ? "Keep going" : "Early days";

  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
            fill="transparent"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(var(--primary))"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-serif text-4xl font-semibold tabular-nums text-ink">
              {v}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-ink-muted">
              readiness
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-ink-muted">Verdict</div>
        <div className="font-serif text-2xl font-semibold">{verdict}</div>
        <p className="text-sm text-ink-muted mt-2 max-w-xs">
          A blend of recent accuracy, your last mock score, and how broadly
          you&apos;ve covered the sections.
        </p>
      </div>
    </div>
  );
}
