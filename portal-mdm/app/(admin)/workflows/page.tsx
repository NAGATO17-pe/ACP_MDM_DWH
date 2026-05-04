import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { HomologationClient } from "./homologation-client";
import { getPendingHomologations, getReinjectionStats } from "@/lib/api/homologation";
import { JWT_COOKIE_NAME } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Workflows y Homologación" };

export default async function WorkflowsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(JWT_COOKIE_NAME)?.value;

  // Carga paralela de datos iniciales
  const [pendingHomologations, reinjectionData] = await Promise.all([
    getPendingHomologations(token),
    getReinjectionStats(token),
  ]);

  const reinyeccionCount = reinjectionData?.candidatos || 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Homologación"
        description="Ajusta y valida registros rechazados para integrarlos al Data Warehouse."
      />

      <HomologationClient 
        initialData={pendingHomologations} 
        reinyeccionCount={reinyeccionCount}
      />
    </div>
  );
}
