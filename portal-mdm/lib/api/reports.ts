const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ReportFormat = "csv" | "pdf";

export async function downloadReport(id: string, format: ReportFormat): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/v1/reports/${id}/download?format=${format}`, {
    headers: { accept: format === "pdf" ? "application/pdf" : "text/csv" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Error al generar el reporte: ${res.statusText}`);
  }

  return res.blob();
}
