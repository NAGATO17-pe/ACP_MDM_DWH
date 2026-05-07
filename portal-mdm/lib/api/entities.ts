import { apiFetch } from "./client";
import {
  entityListResponseSchema,
  mdmEntitySchema,
  type CreateEntityInput,
  type MdmEntity,
  type UpdateEntityInput,
} from "@/lib/schemas/entities";

export interface EntityListParams {
  type?: string;
  status?: string;
  page?: number;
  size?: number;
}

export interface EntityListResponse {
  data: MdmEntity[];
  total: number;
}

export async function getEntities(params: EntityListParams = {}): Promise<EntityListResponse> {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  if (params.status) qs.set("status", params.status);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  const query = qs.toString();
  const raw = await apiFetch<unknown>(`/api/v1/entities${query ? `?${query}` : ""}`);
  return entityListResponseSchema.parse(raw);
}

export async function createEntity(body: CreateEntityInput): Promise<MdmEntity> {
  const raw = await apiFetch<unknown>("/api/v1/entities", { method: "POST", body });
  return mdmEntitySchema.parse(raw);
}

export async function updateEntity(id: string, body: UpdateEntityInput): Promise<MdmEntity> {
  const raw = await apiFetch<unknown>(`/api/v1/entities/${id}`, { method: "PUT", body });
  return mdmEntitySchema.parse(raw);
}
