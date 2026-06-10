import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { AlertsClient } from "./alerts-client";

export const metadata: Metadata = { title: "Centro de alertas" };

export default function AlertsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Centro de alertas"
        description="Incidencias derivadas del ETL y de la cuarentena MDM."
      />
      <AlertsClient />
    </div>
  );
}
