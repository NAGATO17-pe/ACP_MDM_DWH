import { z } from "zod";

export const MODEL_STATUSES = ["produccion", "staging", "archivado"] as const;
export const modelStatusSchema = z.enum(MODEL_STATUSES);
export type ModelStatus = (typeof MODEL_STATUSES)[number];

export const MODEL_STATUS_LABEL: Record<ModelStatus, string> = {
  produccion: "Producción",
  staging: "Staging",
  archivado: "Archivado",
};

export const predictiveModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  algorithm: z.string(),
  target: z.string(),
  accuracy: z.number().min(0).max(1),
  auc: z.number().min(0).max(1),
  f1: z.number().min(0).max(1),
  status: modelStatusSchema,
  trainedAt: z.string(),
  predictions24h: z.number().int().nonnegative(),
});

export const modelListResponseSchema = z.object({
  data: z.array(predictiveModelSchema),
  total: z.number(),
});

export type PredictiveModel = z.infer<typeof predictiveModelSchema>;
export type ModelListResponse = z.infer<typeof modelListResponseSchema>;
