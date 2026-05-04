import { z } from "zod";

export const homologationRecordSchema = z.object({
  id_registro: z.union([z.string(), z.number()]),
  tabla: z.string(),
  campo: z.string(),
  texto_crudo: z.string(),
  valor_sugerido: z.string().nullable().optional(),
  score: z.number().default(0),
  fecha: z.string(),
  estado: z.string(),
});

export type HomologationRecord = z.infer<typeof homologationRecordSchema>;

export const homologationResponseSchema = z.object({
  datos: z.array(z.any()), // Backend uses dynamic fields, we'll map them
  total: z.number(),
});
