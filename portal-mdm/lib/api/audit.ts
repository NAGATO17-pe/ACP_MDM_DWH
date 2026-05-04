import { apiFetch } from "./client";
import { etlAuditResponseSchema, type EtlLog } from "@/lib/schemas/audit-etl";

/**
 * Obtiene el historial de auditoría ETL del backend.
 * @param limite Número máximo de registros a retornar.
 * @param token Token JWT para autenticación (necesario en Server Components).
 */
export async function getEtlAuditLogs(limite: number = 200, token?: string): Promise<EtlLog[]> {
  const data = await apiFetch<unknown>(`/api/v1/auditoria/log-carga?limite=${limite}`, {
    token,
    cache: "no-store",
  });
  
  return etlAuditResponseSchema.parse(data);
}

/**
 * Obtiene el último estado de una tabla específica.
 */
export async function getEtlTableStatus(tableName: string, token?: string): Promise<EtlLog | null> {
  try {
    const data = await apiFetch<unknown>(`/api/v1/auditoria/log-carga/${tableName}`, {
      token,
      cache: "no-store",
    });
    // Si es un solo objeto, lo validamos con el schema base
    const { etlLogSchema } = await import("@/lib/schemas/audit-etl");
    return etlLogSchema.parse(data);
  } catch (err) {
    console.error(`Error fetching status for table ${tableName}:`, err);
    return null;
  }
}
