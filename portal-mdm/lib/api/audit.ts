import { apiFetch, apiFetchBlob } from "./client";

export interface AuditLog {
  id: string;
  action: string;
  resource: string;
  user: string;
  details: string;
  timestamp: string;
}

export interface AuditListParams {
  action?: string;
  page?: number;
  size?: number;
}

export interface AuditListResponse {
  data: AuditLog[];
  total: number;
}

export function getAuditLogs(params: AuditListParams = {}): Promise<AuditListResponse> {
  const qs = new URLSearchParams();
  if (params.action) qs.set("action", params.action);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  const query = qs.toString();
  return apiFetch(`/api/v1/auditoria${query ? `?${query}` : ""}`);
}

export function downloadAuditCsv(): Promise<Blob> {
  return apiFetchBlob("/api/v1/auditoria/export?format=csv", { accept: "text/csv" });
}
