import type { Metadata } from "next";
import { Compass, Database, FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/charts/kpi-card";
import { ExploreEntities } from "./explore-entities";
import { getEntities } from "@/lib/api/entities";

export const metadata: Metadata = { title: "Exploración de datos" };

export default async function ExplorePage() {
  const { data: entities, total } = await getEntities({ size: 200 }).catch(() => ({
    data: [],
    total: 0,
  }));

  const inProduction = entities.filter((e) => e.status === "validado").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Exploración de datos"
        description="Punto de entrada para análisis y descubrimiento sobre el data warehouse."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Entidades disponibles" value={total} icon={Database} />
        <KpiCard
          label="Validadas"
          value={inProduction}
          delta={total > 0 ? Math.round((inProduction / total) * 100) : 0}
          deltaLabel="del total"
          icon={FlaskConical}
          tone="success"
        />
        <KpiCard
          label="Tipos de entidad"
          value={4}
          icon={Compass}
        />
      </section>

      <ExploreEntities data={entities} />
    </div>
  );
}
