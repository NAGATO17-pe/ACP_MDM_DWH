import { apiFetch } from "./client";
import type { MdmEntityFromApi, CreateEntityInput, UpdateEntityInput } from "@/lib/schemas/entities";

export interface EntityListParams {
  type?: string;
  status?: string;
  page?: number;
  size?: number;
}

export interface EntityListResponse {
  data: MdmEntityFromApi[];
  total: number;
}

export function getEntities(params: EntityListParams = {}): Promise<EntityListResponse> {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  if (params.status) qs.set("status", params.status);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  const query = qs.toString();
  return apiFetch(`/api/v1/entities${query ? `?${query}` : ""}`);
}

export function createEntity(body: CreateEntityInput): Promise<MdmEntityFromApi> {
  return apiFetch("/api/v1/entities", { method: "POST", body });
}

export function updateEntity(id: string, body: UpdateEntityInput): Promise<MdmEntityFromApi> {
  return apiFetch(`/api/v1/entities/${id}`, { method: "PUT", body });
}
