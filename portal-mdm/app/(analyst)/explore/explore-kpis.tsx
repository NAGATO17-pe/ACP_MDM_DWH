"use client";

import { Database, FlaskConical, ShieldAlert } from "lucide-react";
import { KpiCard } from "@/components/charts/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { useDwhState, useQualityKpis } from "@/hooks/use-control-center";

export function ExploreKpis() {
  const dwh = useDwhState();
  const quality = useQualityKpis();

  return (
    <section
      aria-label="Resumen del data warehouse"
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      {dwh.isLoading && !dwh.data ? (
        <Skeleton className="h-[100px] rounded-md" />
      ) : (
        <KpiCard
          label="Datasets disponibles"
          value={dwh.data ? formatNumber(dwh.data.tables) : "—"}
          icon={Database}
        />
      )}

      <KpiCard
        label="Modelos en producción"
        value={3}
        delta={50}
        deltaLabel="vs. trimestre"
        icon={FlaskConical}
        tone="success"
      />

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
    </section>
  );
}
