"use client";

import * as React from "react";
import { Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useBlobDownload } from "@/hooks/use-blob-download";
import { downloadReport, type ReportFormat } from "@/lib/api/reports";
import { getErrorMessage } from "@/lib/api/client";

const REPORTS = [
  {
    id: "RPT-001",
    title: "Reporte mensual de calidad MDM",
    description: "PDF con KPIs de completitud, validez y errores activos.",
    formats: ["PDF", "Excel"] as const,
  },
  {
    id: "RPT-002",
    title: "Performance de modelos predictivos",
    description: "Métricas comparadas (AUC, F1) entre modelos en producción.",
    formats: ["PDF"] as const,
  },
  {
    id: "RPT-003",
    title: "Top 100 entidades con más cambios",
    description: "Listado priorizado para revisión del equipo de gobierno.",
    formats: ["Excel"] as const,
  },
  {
    id: "RPT-004",
    title: "Auditoría de aprobaciones",
    description: "Detalle de workflows aprobados / rechazados por usuario.",
    formats: ["PDF", "Excel"] as const,
  },
];

export function ReportsClient() {
  const { toast, update } = useToast();
  const downloadBlob = useBlobDownload();
  const [downloading, setDownloading] = React.useState<string | null>(null);

  async function handleDownload(id: string, format: "PDF" | "Excel") {
    const key = id + format;
    setDownloading(key);
    const toastId = toast({ title: "Generando reporte…", duration: 60_000 });
    try {
      const fmt: ReportFormat = format === "PDF" ? "pdf" : "csv";
      const blob = await downloadReport(id, fmt);
      downloadBlob(blob, `${id}.${fmt}`);
      update(toastId, { title: "Reporte descargado", variant: "success", duration: 4000 });
    } catch (err) {
      update(toastId, {
        title: "Error al generar",
        description: getErrorMessage(err),
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reportes"
        description="Plantillas pre-configuradas para análisis ejecutivo y auditoría."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {REPORTS.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="bg-[var(--color-surface-2)] text-[var(--color-primary)] inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                >
                  <FileText className="h-5 w-5" />
                </span>
                <div className="flex flex-col gap-1">
                  <CardTitle>{r.title}</CardTitle>
                  <CardDescription>{r.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-muted)]">
                Formatos: {r.formats.join(" · ")}
              </span>
              <div className="flex items-center gap-2">
                {r.formats.map((fmt) => {
                  const key = r.id + fmt;
                  return (
                    <Button
                      key={fmt}
                      variant="outline"
                      size="sm"
                      disabled={downloading === key}
                      onClick={() => handleDownload(r.id, fmt)}
                    >
                      <Download aria-hidden className="h-4 w-4" />
                      {downloading === key ? "Generando…" : fmt}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
