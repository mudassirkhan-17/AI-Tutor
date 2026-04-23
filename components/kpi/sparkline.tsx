"use client";

import * as React from "react";

export function Sparkline({
  values,
  height = 36,
  className = "",
}: {
  values: number[];
  height?: number;
  className?: string;
}) {
  const gradId = React.useId().replace(/:/g, "");
  if (!values.length) return null;
  const w = 100;
  const h = height;
  const max = Math.max(100, ...values);
  const min = Math.min(0, ...values);
  const dx = w / Math.max(1, values.length - 1);
  const path = values
    .map((v, i) => {
      const x = i * dx;
      const y = h - ((v - min) / (max - min || 1)) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const area =
    `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`w-full ${className}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
