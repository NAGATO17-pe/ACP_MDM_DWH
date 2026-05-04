import type { Metadata } from "next";
import { cookies } from "next/headers";
import { 
  BarChart3, 
  CheckCircle2, 
  FileSearch2, 
  LayoutDashboard, 
  ShieldAlert, 
  Target,
  Database
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/charts/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QUALITY_KPIS } from "@/lib/mock/quality";
import { formatNumber } from "@/lib/format";
import {
  QualityByEntityChart,
  QualityGauge,
  QualityRadarChart,
  QualityTrendChart,
} from "./quality-charts";
import { QuarantineTable } from "./quarantine-table";
import { getQuarantineRecords } from "@/lib/api/quarantine";
import { JWT_COOKIE_NAME } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Calidad de datos y Cuarentena" };

export default async function QualityPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(JWT_COOKIE_NAME)?.value;

  // Real data from FastAPI
  const { datos: quarantineData, total: totalQuarantine } = await getQuarantineRecords(1, 100, token);
  
  const k = QUALITY_KPIS;
  const pendingQuarantine = quarantineData.filter(d => d.estado.toUpperCase() === "PENDIENTE").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calidad de datos"
        description="Monitor de salud de los datos maestros y gestión de registros en cuarentena."
      />

      <section
        aria-label="KPIs principales"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          label="Completitud global"
          value={k.completeness.toFixed(1)}
          unit="%"
          delta={k.deltas.completeness}
          icon={Target}
          tone="success"
        />
        <KpiCard
          label="En Cuarentena"
          value={totalQuarantine}
          delta={totalQuarantine > 0 ? 5 : 0}
          deltaLabel="nuevos hoy"
          icon={ShieldAlert}
          tone={totalQuarantine > 0 ? "destructive" : "success"}
        />
        <KpiCard
          label="Pendientes revisión"
          value={pendingQuarantine}
          icon={Database}
          tone={pendingQuarantine > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="Score global"
          value={k.globalScore}
          unit="/100"
          icon={FileSearch2}
        />
      </section>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="quarantine" className="gap-2">
            <ShieldAlert className="h-4 w-4" />
            Cuarentena
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Calidad por entidad</CardTitle>
                <CardDescription>
                  Comparativa de cumplimiento de calidad por tipo de entidad maestra.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QualityByEntityChart />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Score global</CardTitle>
                <CardDescription>
                  Indicador agregado de calidad maestra.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <QualityGauge score={k.globalScore} />
                <div className="mt-4 text-center">
                  <span className="text-4xl font-bold text-[var(--color-primary)]">{k.globalScore}</span>
                  <span className="ml-1 text-sm text-[var(--color-text-muted)]">/ 100</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evolución de Errores</CardTitle>
                <CardContent>
                  <QualityTrendChart />
                </CardContent>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Análisis Multidimensional</CardTitle>
                <CardContent>
                  <QualityRadarChart />
                </CardContent>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quarantine" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle>Registros Rechazados</CardTitle>
                <CardDescription>
                  Listado de datos que no superaron las reglas de validación y requieren atención.
                </CardDescription>
              </div>
              <Badge variant="destructive" className="animate-pulse w-fit">
                {totalQuarantine} registros
              </Badge>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <div className="overflow-x-auto">
                <QuarantineTable initialData={quarantineData} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
