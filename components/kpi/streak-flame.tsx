"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";

export function StreakFlame({ days }: { days: number }) {
  return (
    <motion.div
      className="relative h-10 w-10 grid place-items-center"
      initial={{ scale: 0.85 }}
      animate={{ scale: [1, 1.06, 1] }}
      transition={{ duration: 2.2, repeat: Infinity }}
    >
      <span
        className={`absolute inset-0 rounded-full ${
          days > 0 ? "bg-warn/25" : "bg-muted/50"
        } animate-pulse-ring`}
        aria-hidden
      />
      <Flame className={`relative h-5 w-5 ${days > 0 ? "text-warn" : "text-ink-muted"}`} />
    </motion.div>
  );
}
