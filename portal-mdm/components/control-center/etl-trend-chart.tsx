"use client";

/**
 * Chart aislado del AreaChart de Tendencia ETL.
 *
 * Se extrajo a un archivo propio para poder cargarlo via `next/dynamic`
 * con `ssr: false` desde `dashboard-cards.tsx`. Eso saca Recharts
 * (~400 KB sin gzip) del bundle inicial del `/dashboard`: el usuario
 * ve los datos (números, KPIs, alerts, actividad) de inmediato y
 * Recharts llega en un chunk async.
 *
 * No hace fetching propio — recibe los datos como prop.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RECHARTS_THEME } from "@/components/charts/recharts-theme";

interface EtlTrendPoint {
  date: string;
  success: number;
  failed: number;
}

interface EtlTrendChartProps {
  data: EtlTrendPoint[];
}

const TOOLTIP = {
  contentStyle: {
    background: RECHARTS_THEME.surface,
    border: `1px solid ${RECHARTS_THEME.border}`,
    borderRadius: 8,
    fontSize: 12,
    color: RECHARTS_THEME.text,
  },
} as const;

export function EtlTrendChart({ data }: EtlTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="cc-ok" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={RECHARTS_THEME.success}
              stopOpacity={0.45}
            />
            <stop
              offset="100%"
              stopColor={RECHARTS_THEME.success}
              stopOpacity={0}
            />
          </linearGradient>
          <linearGradient id="cc-fail" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={RECHARTS_THEME.destructive}
              stopOpacity={0.45}
            />
            <stop
              offset="100%"
              stopColor={RECHARTS_THEME.destructive}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={RECHARTS_THEME.border} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          stroke={RECHARTS_THEME.textMuted}
          fontSize={12}
        />
        <YAxis stroke={RECHARTS_THEME.textMuted} fontSize={12} />
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="success"
          name="Éxitos"
          stroke={RECHARTS_THEME.success}
          fill="url(#cc-ok)"
          strokeWidth={2.5}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="failed"
          name="Fallos"
          stroke={RECHARTS_THEME.destructive}
          fill="url(#cc-fail)"
          strokeWidth={2.5}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
