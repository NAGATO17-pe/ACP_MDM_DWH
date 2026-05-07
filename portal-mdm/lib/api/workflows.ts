import { apiFetch } from "./client";
import {
  workflowListResponseSchema,
  workflowSchema,
  type RejectWorkflowInput,
  type WorkflowFromApi,
} from "@/lib/schemas/workflows";

export interface WorkflowListParams {
  status?: string;
}

export interface WorkflowListResponse {
  data: WorkflowFromApi[];
  total: number;
}

export async function getWorkflows(params: WorkflowListParams = {}): Promise<WorkflowListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  const query = qs.toString();
  const raw = await apiFetch<unknown>(`/api/v1/workflows${query ? `?${query}` : ""}`);
  return workflowListResponseSchema.parse(raw);
}

export async function approveWorkflow(id: string): Promise<WorkflowFromApi> {
  const raw = await apiFetch<unknown>(`/api/v1/workflows/${id}/approve`, { method: "POST" });
  return workflowSchema.parse(raw);
}

export async function rejectWorkflow(
  id: string,
  body: RejectWorkflowInput,
): Promise<WorkflowFromApi> {
  const raw = await apiFetch<unknown>(`/api/v1/workflows/${id}/reject`, {
    method: "POST",
    body,
  });
  return workflowSchema.parse(raw);
}
