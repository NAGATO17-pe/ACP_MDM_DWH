import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { EntitiesClient } from "./entities-client";

export const metadata: Metadata = { title: "Entidades MDM" };

export default function EntitiesPage() {
  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="Entidades MDM"
        description="Gestión de entidades maestras: clientes, productos, proveedores y ubicaciones."
      />
      <EntitiesClient />
    </div>
  );
}
