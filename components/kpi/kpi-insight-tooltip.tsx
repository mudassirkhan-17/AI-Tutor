"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { KPI_HELP, type KpiHelpKey } from "@/components/kpi/kpi-help-copy";

type Props = {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Classes on the hover/focus trigger wrapper */
  className?: string;
};

export function KpiInsightTooltip({
  title,
  description,
  children,
  className,
}: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          className={cn(
            "block h-full rounded-2xl outline-none cursor-help touch-manipulation focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 ring-offset-background",
            className,
          )}
        >
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="max-w-[min(288px,calc(100vw-2rem))] px-3 py-2.5 text-left font-sans normal-case tracking-normal shadow-soft"
      >
        <p className="font-semibold text-[13px] text-background leading-snug">
          {title}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-background/88">
          {description}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function KpiInsightByKey({
  k,
  children,
  className,
}: {
  k: KpiHelpKey;
  children: React.ReactNode;
  className?: string;
}) {
  const { title, description } = KPI_HELP[k];
  return (
    <KpiInsightTooltip title={title} description={description} className={className}>
      {children}
    </KpiInsightTooltip>
  );
}
