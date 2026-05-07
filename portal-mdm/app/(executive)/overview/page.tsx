import type { Metadata } from "next";
import {
  Award,
  CheckCircle2,
  Database,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/charts/kpi-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getExecutiveOverview } from "@/lib/api/quality";
import type { ExecutiveOverview } from "@/lib/schemas/quality";
import { formatNumber } from "@/lib/format";
import {
  ExecutiveByEntityChart,
  ExecutiveTrendChart,
} from "./overview-charts";

export const metadata: Metadata = { title: "Overview ejecutivo" };

const EMPTY_OVERVIEW: ExecutiveOverview = {
  kpis: {
    completeness: 0,
    validated: 0,
    activeErrors: 0,
    globalScore: 0,
    deltas: { completeness: 0, validated: 0, activeErrors: 0, globalScore: 0 },
  },
  byEntity: [],
  trend: [],
  strategic: {
    activeInitiatives: { total: 0, inPlan: 0, inExecution: 0, inClosure: 0 },
    areaCoverage: { integrated: 0, total: 0 },
    estimatedAnnualSavingsUsd: 0,
    activeEntities: 0,
    activeEntitiesDeltaPct: 0,
    criticalAlerts: 0,
    criticalAlertsDeltaPct: 0,
  },
};

function formatUsdCompact(amount: number): string {
  if (amount >= 1_000_000) return `USD ${(amount / 1_000_000).toFixed(1)} M`;
  if (amount >= 1_000) return `USD ${(amount / 1_000).toFixed(0)} K`;
  return `USD ${amount}`;
}

export default async function OverviewPage() {
  const overview = await getExecutiveOverview().catch(() => EMPTY_OVERVIEW);
  const k = overview.kpis;
  const s = overview.strategic;
  const coveragePct = s.areaCoverage.total > 0
    ? Math.round((s.areaCoverage.integrated / s.areaCoverage.total) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview ejecutivo"
        description="Indicadores estratégicos de la plataforma de datos maestros."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Score global MDM"
          value={k.globalScore}
          unit="/100"
          delta={k.deltas.globalScore}
          deltaLabel="vs. mes"
          icon={Award}
          tone="success"
        />
        <KpiCard
          label="Entidades validadas"
          value={`${k.validated.toFixed(0)}%`}
          delta={k.deltas.validated}
          deltaLabel="vs. mes"
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Entidades activas"
          value={formatNumber(s.activeEntities)}
          delta={s.activeEntitiesDeltaPct}
          deltaLabel="vs. mes"
          icon={Database}
        />
        <KpiCard
          label="Alertas críticas"
          value={s.criticalAlerts}
          delta={s.criticalAlertsDeltaPct}
          deltaLabel="vs. semana"
          icon={ShieldAlert}
          tone="success"
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolución de validaciones</CardTitle>
            <CardDescription>
              Crecimiento de entidades validadas en los últimos 12 meses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExecutiveTrendChart data={overview.trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Calidad por entidad</CardTitle>
            <CardDescription>
              Score actual por tipo de entidad maestra.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExecutiveByEntityChart data={overview.byEntity} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen estratégico</CardTitle>
          <CardDescription>
            Avance del programa MDM en el trimestre actual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Iniciativas activas
              </span>
              <span className="tabular-nums text-3xl font-bold">
                {s.activeInitiatives.total}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {s.activeInitiatives.inPlan} en plan, {s.activeInitiatives.inExecution} en ejecución, {s.activeInitiatives.inClosure} en cierre
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Cobertura de áreas
              </span>
              <span className="tabular-nums text-3xl font-bold">
                {s.areaCoverage.integrated} / {s.areaCoverage.total}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {coveragePct}% de áreas integradas al MDM
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Ahorro estimado anual
              </span>
              <span className="tabular-nums text-3xl font-bold">
                {formatUsdCompact(s.estimatedAnnualSavingsUsd)}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Por reducción de duplicidades y reprocesos
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
