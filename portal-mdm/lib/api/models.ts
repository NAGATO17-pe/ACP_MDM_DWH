import { apiFetch } from "./client";
import {
  modelListResponseSchema,
  predictiveModelSchema,
  type ModelListResponse,
  type PredictiveModel,
} from "@/lib/schemas/models";

export async function getModels(): Promise<ModelListResponse> {
  const raw = await apiFetch<unknown>("/api/v1/models");
  return modelListResponseSchema.parse(raw);
}

export async function getModelById(id: string): Promise<PredictiveModel> {
  const raw = await apiFetch<unknown>(`/api/v1/models/${id}`);
  return predictiveModelSchema.parse(raw);
}
