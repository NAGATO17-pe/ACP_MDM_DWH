"use client";

import { Database, ShieldAlert, CheckCircle2, ClipboardList } from "lucide-react";
import { KpiCard } from "@/components/charts/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { useDwhState, useQualityKpis } from "@/hooks/use-control-center";

export function OverviewKpis() {
  const dwh = useDwhState();
  const quality = useQualityKpis();

  return (
    <section
      aria-label="KPIs de calidad y data warehouse"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {/* Registros totales en cuarentena */}
      {quality.isLoading && !quality.data ? (
        <Skeleton className="h-[100px] rounded-md" />
      ) : (
        <KpiCard
          label="Registros cuarentena"
          value={quality.data ? formatNumber(quality.data.total) : "—"}
          icon={ClipboardList}
        />
      )}

      {/* Pendientes cuarentena */}
      {quality.isLoading && !quality.data ? (
        <Skeleton className="h-[100px] rounded-md" />
      ) : (
        <KpiCard
          label="Pendientes cuarentena"
          value={quality.data ? formatNumber(quality.data.pendientes) : "—"}
          icon={ShieldAlert}
          tone={
            (quality.data?.pendientes ?? 0) > 0 ? "warning" : "success"
          }
          delta={
            (quality.data?.pendientes ?? 0) > 0
              ? quality.data!.pendientes
              : undefined
          }
          deltaLabel="requieren revisión"
        />
      )}

      {/* Tasa de resolución */}
      {quality.isLoading && !quality.data ? (
        <Skeleton className="h-[100px] rounded-md" />
      ) : (
        <KpiCard
          label="Tasa de resolución"
          value={
            quality.data != null
              ? `${quality.data.resolutionRate.toFixed(1)}%`
              : "—"
          }
          icon={CheckCircle2}
          tone={
            (quality.data?.resolutionRate ?? 0) >= 90 ? "success" : "warning"
          }
        />
      )}

      {/* Tablas en DWH */}
      {dwh.isLoading && !dwh.data ? (
        <Skeleton className="h-[100px] rounded-md" />
      ) : (
        <KpiCard
          label="Tablas en DWH"
          value={dwh.data ? formatNumber(dwh.data.tables) : "—"}
          icon={Database}
        />
      )}
    </section>
  );
}
