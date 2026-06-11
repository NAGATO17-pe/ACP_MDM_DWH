"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RECHARTS_THEME } from "@/components/charts/recharts-theme";
import {
  useQualityTrend,
  useQualityByTable,
  useQualityKpis,
} from "@/hooks/use-control-center";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/charts/kpi-card";
import { FileSearch2, Target } from "lucide-react";

const TOOLTIP_STYLE = {
  contentStyle: {
    background: RECHARTS_THEME.surface,
    border: `1px solid ${RECHARTS_THEME.border}`,
    borderRadius: 8,
    fontSize: 12,
    color: "#F8FAFC",
  },
  labelStyle: { color: RECHARTS_THEME.textMuted },
} as const;

/* -------------------------------------------------------------------------- */
/* QualityByEntityChart — stacked bar by table from cuarentena               */
/* -------------------------------------------------------------------------- */

export function QualityByEntityChart() {
  const { data, isLoading, isError } = useQualityByTable();

  if (isLoading && !data) {
    return <Skeleton className="h-[260px] w-full rounded-md" />;
  }
  if (isError) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">
        Error al cargar datos de calidad por tabla
      </p>
    );
  }
  if (!data?.length) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">
        Sin registros de cuarentena por tabla
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid stroke={RECHARTS_THEME.border} strokeDasharray="3 3" />
        <XAxis dataKey="tabla" stroke={RECHARTS_THEME.textMuted} fontSize={12} />
        <YAxis stroke={RECHARTS_THEME.textMuted} fontSize={12} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="pendientes"
          name="Pendientes"
          stackId="a"
          fill={RECHARTS_THEME.warning}
        />
        <Bar
          dataKey="resueltos"
          name="Resueltos"
          stackId="a"
          fill={RECHARTS_THEME.success}
        />
        <Bar
          dataKey="descartados"
          name="Descartados"
          stackId="a"
          fill={RECHARTS_THEME.border}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* QualityTrendChart — area chart from bitacora                               */
/* -------------------------------------------------------------------------- */

export function QualityTrendChart() {
  const { data, isLoading, isError } = useQualityTrend(30);

  if (isLoading && !data) {
    return <Skeleton className="h-[260px] w-full rounded-md" />;
  }
  if (isError) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">
        Error al cargar tendencia de calidad
      </p>
    );
  }
  if (!data?.length) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">
        Sin datos de bitácora en el período
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="rechazadas-grad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={RECHARTS_THEME.destructive}
              stopOpacity={0.4}
            />
            <stop
              offset="100%"
              stopColor={RECHARTS_THEME.destructive}
              stopOpacity={0}
            />
          </linearGradient>
          <linearGradient id="insertadas-grad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={RECHARTS_THEME.success}
              stopOpacity={0.4}
            />
            <stop
              offset="100%"
              stopColor={RECHARTS_THEME.success}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={RECHARTS_THEME.border} strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke={RECHARTS_THEME.textMuted} fontSize={12} />
        <YAxis stroke={RECHARTS_THEME.textMuted} fontSize={12} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="rechazadas"
          name="Rechazadas"
          stroke={RECHARTS_THEME.destructive}
          fill="url(#rechazadas-grad)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="insertadas"
          name="Insertadas"
          stroke={RECHARTS_THEME.success}
          fill="url(#insertadas-grad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* QualityGauge — score bar (score prop from parent)                          */
/* -------------------------------------------------------------------------- */

export function QualityGauge({ score }: { score: number }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        layout="vertical"
        data={[{ name: "score", score, rest: 100 - score }]}
        margin={{ top: 10, right: 16, left: 16, bottom: 10 }}
        stackOffset="expand"
      >
        <XAxis type="number" hide domain={[0, 100]} />
        <YAxis type="category" dataKey="name" hide />
        <Bar
          dataKey="score"
          stackId="a"
          fill={RECHARTS_THEME.primary}
          radius={[6, 0, 0, 6]}
        />
        <Bar
          dataKey="rest"
          stackId="a"
          fill={RECHARTS_THEME.border}
          radius={[0, 6, 6, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* QualityGaugeWithData — client island: fetches resolutionRate via hook      */
/* -------------------------------------------------------------------------- */

export function QualityGaugeWithData() {
  const { data, isLoading } = useQualityKpis();

  const score =
    data && data.total > 0
      ? Math.round(((data.resueltos + data.descartados) / data.total) * 100)
      : data
        ? 100
        : 0;

  if (isLoading && !data) {
    return <Skeleton className="h-[220px] w-full rounded-md" />;
  }

  return (
    <>
      <QualityGauge score={score} />
      <div className="mt-4 text-center">
        <span className="text-4xl font-bold text-[var(--color-primary)]">
          {score}
        </span>
        <span className="ml-1 text-sm text-[var(--color-text-muted)]">/ 100</span>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* QualityKpiSection — client island: 2 KPI cards from useQualityKpis        */
/* -------------------------------------------------------------------------- */

export function QualityKpiSection() {
  const { data, isLoading } = useQualityKpis();

  const score =
    data && data.total > 0
      ? Math.round(((data.resueltos + data.descartados) / data.total) * 100)
      : data
        ? 100
        : 0;

  if (isLoading && !data) {
    return (
      <>
        <Skeleton className="h-[120px] rounded-md" />
        <Skeleton className="h-[120px] rounded-md" />
      </>
    );
  }

  return (
    <>
      <KpiCard
        label="Tasa de resolución"
        value={(data?.resolutionRate ?? score).toFixed(1)}
        unit="%"
        icon={Target}
        tone={score >= 80 ? "success" : score >= 50 ? "warning" : "destructive"}
      />
      <KpiCard
        label="Score global"
        value={score}
        unit="/100"
        icon={FileSearch2}
        tone={score >= 80 ? "success" : score >= 50 ? "warning" : "destructive"}
      />
    </>
  );
}
