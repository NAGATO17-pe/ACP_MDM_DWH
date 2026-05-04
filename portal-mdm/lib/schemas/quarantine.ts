import { z } from "zod";

export const quarantineRecordSchema = z.object({
  id_registro: z.union([z.string(), z.number()]),
  tabla_origen: z.string(),
  columna_origen: z.string().nullable().optional(),
  valor_raw: z.any().nullable().optional(),
  nombre_archivo: z.string().nullable().optional(),
  fecha_ingreso: z.string(),
  estado: z.string(), // PENDIENTE, RESUELTO, etc.
  motivo: z.string().nullable().optional(),
});

export type QuarantineRecord = z.infer<typeof quarantineRecordSchema>;

export const quarantineResponseSchema = z.object({
  datos: z.array(quarantineRecordSchema),
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
});
