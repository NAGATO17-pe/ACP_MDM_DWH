import { z } from "zod";

export const etlLogSchema = z.object({
  id_log: z.number(),
  nombre_proceso: z.string().nullable().optional(),
  tabla_destino: z.string(),
  nombre_archivo: z.string().nullable().optional(),
  fecha_inicio: z.string(), // ISO format
  fecha_fin: z.string().nullable().optional(),
  estado: z.string(), // OK, ERROR, RUNNING, SKIPPED, TIMEOUT, etc.
  filas_insertadas: z.number().default(0),
  filas_rechazadas: z.number().default(0),
  duracion_segundos: z.number().nullable().optional(),
  mensaje_error: z.string().nullable().optional(),
});

export type EtlLog = z.infer<typeof etlLogSchema>;

export const etlAuditResponseSchema = z.array(etlLogSchema);
