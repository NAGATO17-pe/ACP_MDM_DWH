import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { CatalogosClient } from "./catalogos-client";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Catálogos — Portal MDM" };
export const dynamic = "force-dynamic";

export default async function CatalogosPage() {
  const session = await getSession();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Catálogos"
        description="Variedades homologadas, geografía agrícola y catálogo de personal del DWH."
      />
      <CatalogosClient isReadOnly={session?.role === "analyst"} />
    </div>
  );
}
