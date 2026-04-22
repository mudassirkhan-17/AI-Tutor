import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function letterOf(index: number): "A" | "B" | "C" | "D" {
  return (["A", "B", "C", "D"] as const)[index] ?? "A";
}

/** Compact relative time: "just now" / "12m ago" / "3h ago" / "4d ago" / "Mar 2". */
export function timeAgo(input: string | Date | number | null | undefined): string {
  if (!input) return "";
  const d =
    typeof input === "string" || typeof input === "number"
      ? new Date(input)
      : input;
  const ms = Date.now() - d.getTime();
  if (Number.isNaN(ms)) return "";
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
