import { apiFetch } from "./client";
import { quarantineResponseSchema, type QuarantineRecord } from "@/lib/schemas/quarantine";

/**
 * Obtiene los registros en cuarentena (registros rechazados por validación).
 */
export async function getQuarantineRecords(
  pagina: number = 1, 
  tamano: number = 100, 
  token?: string
): Promise<{ datos: QuarantineRecord[]; total: number }> {
  const data = await apiFetch<unknown>(
    `/api/v1/cuarentena?pagina=${pagina}&tamano=${tamano}`, 
    {
      token,
      cache: "no-store",
    }
  );
  
  const parsed = quarantineResponseSchema.parse(data);
  return {
    datos: parsed.datos,
    total: parsed.total
  };
}
