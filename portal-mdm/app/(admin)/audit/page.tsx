import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Database,
  History,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/charts/kpi-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EtlAuditClient } from "./etl-audit-client";
import { getEtlAuditLogs } from "@/lib/api/audit";
import { JWT_COOKIE_NAME } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Auditoría ETL — Portal MDM" };

export default async function AuditPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(JWT_COOKIE_NAME)?.value;
  
  // Fetch logs from real FastAPI backend
  const etlLogs = await getEtlAuditLogs(100, token);
  
  // Calculate quick KPIs
  const totalRowsOk = etlLogs.reduce((acc, log) => acc + (log.filas_insertadas || 0), 0);
  const totalRowsRej = etlLogs.reduce((acc, log) => acc + (log.filas_rechazadas || 0), 0);
  const errorCount = etlLogs.filter(log => log.estado === "ERROR").length;
  const successRate = etlLogs.length > 0 
    ? Math.round(((etlLogs.length - errorCount) / etlLogs.length) * 100) 
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auditoría ETL"
        description="Historial completo de cargas y trazabilidad de corridas del Pipeline."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Tasa de éxito"
          value={`${successRate}%`}
          icon={CheckCircle2}
          tone={successRate > 90 ? "success" : successRate > 70 ? "warning" : "destructive"}
        />
        <KpiCard
          label="Filas procesadas"
          value={totalRowsOk.toLocaleString()}
          icon={Database}
          tone="info"
        />
        <KpiCard
          label="Rechazos totales"
          value={totalRowsRej.toLocaleString()}
          icon={ShieldAlert}
          tone={totalRowsRej > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="Errores recientes"
          value={errorCount}
          icon={Activity}
          tone={errorCount > 0 ? "destructive" : "success"}
        />
      </section>

      <Tabs defaultValue="etl-history" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="etl-history" className="gap-2">
            <History className="h-4 w-4" />
            Historial ETL
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            Actividad Portal
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="etl-history" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Log de Cargas</CardTitle>
                <CardDescription>
                  Listado de las últimas {etlLogs.length} operaciones del motor ETL.
                </CardDescription>
              </div>
              <BarChart3 className="h-5 w-5 text-muted-foreground opacity-50" />
            </CardHeader>
            <CardContent>
              <EtlAuditClient initialLogs={etlLogs} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Timeline de acciones</CardTitle>
              <CardDescription>
                Registro de navegacion y cambios realizados por usuarios en el portal (MOCK).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="py-10 text-center text-sm text-muted-foreground">
                Módulo de auditoría de usuario en desarrollo.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
