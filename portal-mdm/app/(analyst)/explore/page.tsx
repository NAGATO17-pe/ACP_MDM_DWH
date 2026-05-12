import type { Metadata } from "next";
import { Compass, Database, FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/charts/kpi-card";
import { ExploreEntities } from "./explore-entities";
import { getEntities } from "@/lib/api/entities";

export const metadata: Metadata = { title: "Exploración de datos" };

export default async function ExplorePage() {
  // Fetch first page for KPI counts; ExploreEntities handles its own pagination.
  const { data: entities, total } = await getEntities({ page: 1, size: 20 }).catch(() => ({
    data: [],
    total: 0,
  }));

  const validatedCount = entities.filter((e) => e.status === "validado").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Exploración de datos"
        description="Punto de entrada para análisis y descubrimiento sobre el data warehouse."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Entidades disponibles" value={total} icon={Database} />
        <KpiCard
          label="Validadas (pág. 1)"
          value={validatedCount}
          delta={entities.length > 0 ? Math.round((validatedCount / entities.length) * 100) : 0}
          deltaLabel="de esta página"
          icon={FlaskConical}
          tone="success"
        />
        <KpiCard label="Tipos de entidad" value={4} icon={Compass} />
      </section>

      <ExploreEntities />
    </div>
  );
}
