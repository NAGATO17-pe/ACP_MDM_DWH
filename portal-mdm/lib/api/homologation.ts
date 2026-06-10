import { apiFetch } from "./client";
import { type HomologationRecord } from "@/lib/schemas/homologation";

export async function getPendingHomologations(token?: string): Promise<HomologationRecord[]> {
  const data = await apiFetch<any>(
    "/api/v1/cuarentena?pagina=1&tamano=10000&estado=PENDIENTE",
    { token, cache: "no-store" }
  );

  if (!data?.datos) return [];

  // Mapear campos dinámicos del backend al esquema de Homologación
  return data.datos.map((d: any) => ({
    id_registro: d.id_registro,
    tabla: d.tabla_origen,
    campo: d.columna_origen || "General",
    texto_crudo: d.valor_raw || "—",
    valor_sugerido: d.valor_canonico_sugerido || d.motivo || "",
    score: d.score || 0,
    fecha: d.fecha_ingreso,
    estado: d.estado,
  }));
}

export async function getReinjectionStats(token?: string) {
  return apiFetch<any>("/api/v1/reinyeccion/candidatos", { token });
}
