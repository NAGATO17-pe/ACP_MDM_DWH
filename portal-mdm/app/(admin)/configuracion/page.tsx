import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ConfiguracionClient } from "./configuracion-client";

export const metadata: Metadata = { title: "Configuración — Portal MDM" };
export const dynamic = "force-dynamic";

export default function ConfiguracionPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración"
        description="Tu perfil, preferencias del portal, parámetros del pipeline y usuarios del sistema."
      />
      <ConfiguracionClient />
    </div>
  );
}
