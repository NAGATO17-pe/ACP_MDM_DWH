import { apiFetch } from "./client";
import type { WorkflowFromApi, RejectWorkflowInput } from "@/lib/schemas/workflows";

export interface WorkflowListParams {
  status?: string;
}

export interface WorkflowListResponse {
  data: WorkflowFromApi[];
  total: number;
}

export function getWorkflows(params: WorkflowListParams = {}): Promise<WorkflowListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  const query = qs.toString();
  return apiFetch(`/api/v1/workflows${query ? `?${query}` : ""}`);
}

export function approveWorkflow(id: string): Promise<WorkflowFromApi> {
  return apiFetch(`/api/v1/workflows/${id}/approve`, { method: "POST" });
}

export function rejectWorkflow(id: string, body: RejectWorkflowInput): Promise<WorkflowFromApi> {
  return apiFetch(`/api/v1/workflows/${id}/reject`, { method: "POST", body });
}
