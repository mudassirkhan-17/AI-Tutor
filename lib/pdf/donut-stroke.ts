/**
 * @react-pdf/renderer SVG rejects strokeDasharray segments that are 0
 * ("dash([…, 0], {}) invalid, lengths must be numeric and greater than zero").
 */

const EPS = 0.05;

function clampPct(pct: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
}

/** True when the coloured arc should be drawn (omit entirely at 0%). */
export function donutShowColoredArc(pct: number): boolean {
  return clampPct(pct) > 0;
}

/**
 * Dash pattern for partial arc only. Returns undefined for solid ring (caller uses pct >= 100).
 */
export function donutArcStrokeDasharray(
  pct: number,
  circumference: number,
): string | undefined {
  const p = clampPct(pct);
  if (p <= 0 || p >= 100) return undefined;
  let filled = (p / 100) * circumference;
  filled = Math.max(EPS, Math.min(circumference - EPS, filled));
  const remaining = circumference - filled;
  return `${filled} ${remaining}`;
}
