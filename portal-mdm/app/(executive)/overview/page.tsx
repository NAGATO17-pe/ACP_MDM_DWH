import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ExecutiveByEntityChart,
  ExecutiveTrendChart,
} from "./overview-charts";
import { OverviewKpis } from "./overview-kpis";

export const metadata: Metadata = { title: "Overview ejecutivo" };

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview ejecutivo"
        description="Indicadores estratégicos de la plataforma de datos maestros."
      />

      <OverviewKpis />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolución de validaciones</CardTitle>
            <CardDescription>
              Crecimiento de entidades validadas en los últimos 12 meses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExecutiveTrendChart />
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
            <ExecutiveByEntityChart />
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
              <span className="tabular-nums text-3xl font-bold">12</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                7 en plan, 4 en ejecución, 1 en cierre
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Cobertura de áreas
              </span>
              <span className="tabular-nums text-3xl font-bold">9 / 14</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                64% de áreas integradas al MDM
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Ahorro estimado anual
              </span>
              <span className="tabular-nums text-3xl font-bold">USD 1.2 M</span>
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
