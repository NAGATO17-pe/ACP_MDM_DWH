import { apiFetchBlob } from "./client";

export type ReportFormat = "csv" | "pdf";

const ACCEPT: Record<ReportFormat, string> = {
  pdf: "application/pdf",
  csv: "text/csv",
};

export function downloadReport(id: string, format: ReportFormat): Promise<Blob> {
  return apiFetchBlob(`/api/v1/reports/${id}/download?format=${format}`, {
    accept: ACCEPT[format],
  });
}
