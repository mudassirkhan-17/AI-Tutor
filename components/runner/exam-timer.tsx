"use client";

import * as React from "react";
import { cn, formatMs } from "@/lib/utils";
import { Timer as TimerIcon } from "lucide-react";

export function ExamTimer({
  durationMs,
  startedAt,
  onExpire,
  paused = false,
}: {
  durationMs: number;
  startedAt: number;
  onExpire: () => void;
  paused?: boolean;
}) {
  const [remaining, setRemaining] = React.useState<number>(() =>
    Math.max(0, durationMs - (Date.now() - startedAt)),
  );
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      const left = Math.max(0, durationMs - (Date.now() - startedAt));
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire();
      }
    }, 500);
    return () => clearInterval(t);
  }, [durationMs, startedAt, onExpire, paused]);

  const critical = remaining < 60_000;
  const warn = remaining < 10 * 60_000 && !critical;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium font-mono tabular-nums",
        "border-border bg-surface text-ink",
        warn && "border-warn/40 bg-warn/10 text-warn",
        critical && "border-danger/50 bg-danger/10 text-danger animate-pulse",
      )}
      aria-live="polite"
      role="timer"
    >
      <TimerIcon className="h-4 w-4" />
      {formatMs(remaining)}
    </div>
  );
}
