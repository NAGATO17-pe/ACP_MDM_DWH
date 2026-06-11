import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ProyeccionesClient } from "./proyecciones-client";

export const metadata: Metadata = { title: "Proyecciones de cosecha" };
export const dynamic = "force-dynamic";

export default function ProyeccionesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proyecciones de cosecha"
        description="Motor Six-Week: kg proyectados por semana a partir de conteos fenológicos."
      />
      <ProyeccionesClient />
    </div>
  );
}
