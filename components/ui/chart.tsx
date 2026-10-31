"use client";

import { createContext, useContext, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { ResponsiveContainer, Tooltip as RechartsTooltip, Legend as RechartsLegend } from "recharts";
import { cn } from "cn";

export type ChartConfig = Record<string, { label: string; color: string }>;

const ChartContext = createContext<{ config: ChartConfig } | null>(null);

function useChartConfig() {
  const context = useContext(ChartContext);
  if (!context) throw new Error("Chart components need to be rendered inside ChartContainer.");
  return context.config;
}

export function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig;
  className?: string;
  children: ReactElement;
}) {
  const variables = Object.fromEntries(
    Object.entries(config).map(([key, item]) => [`--color-${key}`, item.color]),
  ) as CSSProperties;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        className={cn("w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/70 [&_.recharts-tooltip-cursor]:fill-muted/60 [&_.recharts-dot]:stroke-background [&_.recharts-layer]:outline-none [&_.recharts-sector]:outline-none", className)}
        style={variables}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsTooltip;
export const ChartLegend = RechartsLegend;

export function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; name?: string; value?: string | number; color?: string; payload?: Record<string, unknown> }>;
  label?: string | number;
  valueFormatter?: (value: unknown) => ReactNode;
}) {
  const config = useChartConfig();
  if (!active || !payload?.length) return null;

  const labelText = String(label ?? "");
  return (
    <div className="min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      {labelText && <p className="mb-1.5 font-medium text-slate-800">{labelText}</p>}
      <div className="space-y-1.5">
        {payload.filter((item) => item.value !== undefined && item.value !== null).map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index);
          const itemConfig = config[key];
          return (
            <div key={`${key}-${index}`} className="flex items-center justify-between gap-5">
              <span className="flex min-w-0 items-center gap-2 text-slate-500">
                <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color ?? `var(--color-${key})` }} />
                <span className="truncate">{itemConfig?.label ?? item.name ?? key}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                {valueFormatter ? valueFormatter(item.value) : new Intl.NumberFormat("id-ID").format(Number(item.value) || 0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartLegendContent({
  payload,
  className,
}: {
  payload?: Array<{ dataKey?: string; value?: string; color?: string }>;
  className?: string;
}) {
  const config = useChartConfig();
  if (!payload?.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2", className)}>
      {payload.map((item, index) => {
        const key = String(item.dataKey ?? item.value ?? index);
        return (
          <span key={`${key}-${index}`} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: item.color ?? `var(--color-${key})` }} />
            {config[key]?.label ?? item.value ?? key}
          </span>
        );
      })}
    </div>
  );
}
