import type { Metadata } from "next";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EtlMonitorClient } from "./etl-monitor-client";

export const metadata: Metadata = { title: "Monitor ETL" };

export default function EtlMonitorPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Monitor ETL"
        description="Historial y estado de las corridas ETL (Auditoria.Log_Carga)."
        actions={
          <Button asChild size="sm" variant="primary">
            <Link href="/etl-monitor/lanzar" aria-label="Lanzar nueva corrida ETL">
              <PlayCircle aria-hidden className="h-4 w-4" />
              Nueva corrida
            </Link>
          </Button>
        }
      />
      <EtlMonitorClient />
    </div>
  );
}
