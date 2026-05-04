import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { getEntities } from "@/lib/api/entities";
import { EntitiesClient } from "./entities-client";

export const metadata: Metadata = { title: "Entidades MDM" };

export default async function EntitiesPage() {
  const { data } = await getEntities({ size: 200 }).catch(() => ({ data: [], total: 0 }));
  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="Entidades MDM"
        description="Gestión de entidades maestras: clientes, productos, proveedores y ubicaciones."
      />
      <EntitiesClient data={data} />
    </div>
  );
}
