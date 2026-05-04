import { apiFetch } from "./client";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function downloadAuditCsv(): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/v1/auditoria/export?format=csv`, {
    headers: { accept: "text/csv" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Error al exportar: ${res.statusText}`);
  return res.blob();
}
