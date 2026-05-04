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

export async function resolveHomologation(
  tabla: string, 
  id: string | number, 
  valor_canonico: string,
  token?: string
) {
  // Limpiar nombre de tabla (ej: 'Bronce.Peladas' -> 'peladas')
  const tablaApi = tabla.split(".").pop()?.toLowerCase() || tabla;
  
  return apiFetch(
    `/api/v1/cuarentena/${tablaApi}/${id}/resolver`,
    {
      method: "PATCH",
      token,
      body: { valor_canonico, comentario: "Resuelto desde Portal Next.js" }
    }
  );
}

export async function rejectHomologation(
  tabla: string, 
  id: string | number, 
  token?: string
) {
  const tablaApi = tabla.split(".").pop()?.toLowerCase() || tabla;
  
  return apiFetch(
    `/api/v1/cuarentena/${tablaApi}/${id}/rechazar`,
    {
      method: "PATCH",
      token,
      body: { motivo: "Rechazado desde Portal Next.js" }
    }
  );
}

export async function getCatalogOptions(campo: string, token?: string): Promise<string[]> {
  const c = campo.toLowerCase();
  let endpoint = "";
  let key = "";

  if (c.includes("variedad")) {
    endpoint = "/api/v1/catalogos/variedades";
    key = "nombre_canonico";
  } else if (["personal", "nombre", "responsable", "trabajador"].some(x => c.includes(x))) {
    endpoint = "/api/v1/catalogos/personal";
    key = "nombre_completo";
  } else if (c.includes("fundo") || c.includes("sector") || c.includes("modulo") || c.includes("turno") || c.includes("valvula") || c.includes("cama")) {
    endpoint = "/api/v1/catalogos/geografia";
    key = c.includes("fundo") ? "fundo" : 
          c.includes("sector") ? "sector" : 
          c.includes("modulo") ? "modulo" : 
          c.includes("turno") ? "turno" : 
          c.includes("valvula") ? "valvula" : "cama";
  }

  if (!endpoint) return [];

  const res = await apiFetch<any>(`${endpoint}?tamano=10000`, { token });
  if (!res?.datos) return [];

  const options = new Set(res.datos.map((d: any) => d[key]).filter(Boolean));
  return Array.from(options).sort() as string[];
}

export async function getReinjectionStats(token?: string) {
  return apiFetch<any>("/api/v1/reinyeccion/candidatos", { token });
}

export async function runReinjection(token?: string) {
  return apiFetch<any>("/api/v1/reinyeccion/ejecutar", { 
    method: "POST",
    token,
    body: {} 
  });
}
