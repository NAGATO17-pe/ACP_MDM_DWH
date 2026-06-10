"use client";

/**
 * Donut chart de Calidad — extraído de `dashboard-cards.tsx` para que
 * Recharts no entre al bundle inicial del `/dashboard`. Ver nota en
 * `etl-trend-chart.tsx` para el rationale completo.
 */

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { RECHARTS_THEME } from "@/components/charts/recharts-theme";

interface QualityPieChartProps {
  pendientes: number;
  resueltos: number;
  descartados: number;
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

export function QualityPieChart({
  pendientes,
  resueltos,
  descartados,
}: QualityPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <PieChart>
        <Tooltip {...TOOLTIP} />
        <Pie
          data={[
            { name: "Pendientes", value: pendientes },
            { name: "Resueltos", value: resueltos },
            { name: "Descartados", value: descartados },
          ]}
          dataKey="value"
          nameKey="name"
          innerRadius={36}
          outerRadius={64}
          paddingAngle={2}
          stroke="none"
          isAnimationActive={false}
        >
          {(
            [
              RECHARTS_THEME.warning,
              RECHARTS_THEME.success,
              RECHARTS_THEME.textMuted,
            ] as const
          ).map((c, i) => (
            <Cell key={i} fill={c} />
          ))}
        </Pie>
        <Legend
          verticalAlign="middle"
          align="right"
          layout="vertical"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
