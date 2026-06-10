"use client";

/**
 * Sparkline aislado para los Hero KPIs.
 *
 * Se carga via `next/dynamic` para mantener Recharts fuera del bundle
 * inicial del `/dashboard`. Los números del KPI aparecen inmediatamente;
 * la línea de tendencia se pinta una fracción de segundo después.
 */

import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface KpiSparklineProps {
  data: { value: number }[];
  color: string;
  gradientId: string;
}

export function KpiSparkline({ data, color, gradientId }: KpiSparklineProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          fill={`url(#${gradientId})`}
          strokeWidth={1.75}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
