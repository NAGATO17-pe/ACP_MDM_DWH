"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RECHARTS_THEME } from "@/components/charts/recharts-theme";
import { useQualityTrend, useQualityByTable } from "@/hooks/use-control-center";
import { Skeleton } from "@/components/ui/skeleton";

const TOOLTIP_STYLE = {
  contentStyle: {
    background: RECHARTS_THEME.surface,
    border: `1px solid ${RECHARTS_THEME.border}`,
    borderRadius: 8,
    fontSize: 12,
    color: "#F8FAFC",
  },
} as const;

export function ExecutiveTrendChart() {
  const { data, isLoading } = useQualityTrend(30);

  if (isLoading && !data) {
    return <Skeleton className="h-[260px] w-full rounded-md" />;
  }

  if (!data?.length) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">
        Sin datos de bitácora disponibles
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="exec-grad-insert" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RECHARTS_THEME.primary} stopOpacity={0.5} />
            <stop offset="100%" stopColor={RECHARTS_THEME.primary} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="exec-grad-reject" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={RECHARTS_THEME.border} strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke={RECHARTS_THEME.textMuted} fontSize={12} />
        <YAxis stroke={RECHARTS_THEME.textMuted} fontSize={12} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Area
          type="monotone"
          dataKey="insertadas"
          name="Insertadas"
          stroke={RECHARTS_THEME.primary}
          fill="url(#exec-grad-insert)"
          strokeWidth={3}
        />
        <Area
          type="monotone"
          dataKey="rechazadas"
          name="Rechazadas"
          stroke="#EF4444"
          fill="url(#exec-grad-reject)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ExecutiveByEntityChart() {
  const { data, isLoading } = useQualityByTable();

  if (isLoading && !data) {
    return <Skeleton className="h-[260px] w-full rounded-md" />;
  }

  if (!data?.length) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">
        Sin datos de cuarentena disponibles
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid stroke={RECHARTS_THEME.border} strokeDasharray="3 3" />
        <XAxis dataKey="tabla" stroke={RECHARTS_THEME.textMuted} fontSize={12} />
        <YAxis stroke={RECHARTS_THEME.textMuted} fontSize={12} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar
          dataKey="pendientes"
          name="Pendientes"
          stackId="a"
          fill="#F59E0B"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="resueltos"
          name="Resueltos"
          stackId="a"
          fill={RECHARTS_THEME.primary}
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="descartados"
          name="Descartados"
          stackId="a"
          fill="#6B7280"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
