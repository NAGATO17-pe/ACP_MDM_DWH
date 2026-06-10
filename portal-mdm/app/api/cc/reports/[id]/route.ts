import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { MODELS } from "@/lib/mock/models";
import {
  FastApiQuarantinePage,
  mapQuarantineRecord,
} from "@/lib/schemas/quality";
import {
  FastApiBitacoraPagina,
  mapBitacoraEntry,
} from "@/lib/schemas/bitacora";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/* -------------------------------------------------------------------------- */
/* CSV helpers                                                                 */
/* -------------------------------------------------------------------------- */

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n"))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(cell), ...rows.map((r) => r.map(cell))]
    .map((row) => row.join(","))
    .join("\r\n");
}

function csvResponse(content: string, filename: string) {
  // BOM (﻿) for Excel UTF-8 auto-detection
  return new Response("﻿" + content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Route                                                                       */
/* -------------------------------------------------------------------------- */

export async function GET(_req: Request, { params }: { params: Params }) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;

  try {
    switch (id) {
      case "RPT-001": {
        // Calidad MDM — registros de cuarentena
        const raw = await fastapiFetch<unknown>(
          "/api/v1/cuarentena?pagina=1&tamano=200",
        );
        const page = FastApiQuarantinePage.parse(raw);
        const records = page.datos.map(mapQuarantineRecord);
        const headers = [
          "Tabla", "ID Registro", "Columna", "Valor Raw",
          "Estado", "Motivo", "Archivo", "Fecha Ingreso",
        ];
        const rows = records.map((r) => [
          r.tablaOrigen, r.idRegistro, r.columnaOrigen, r.valorRaw,
          r.estado, r.motivo ?? "", r.nombreArchivo ?? "", r.fechaIngreso ?? "",
        ]);
        return csvResponse(toCsv(headers, rows), "calidad-mdm.csv");
      }

      case "RPT-002": {
        // Performance de modelos — desde mock
        const headers = [
          "ID", "Nombre", "Algoritmo", "Objetivo",
          "Accuracy", "AUC", "F1", "Estado",
          "Entrenado el", "Predicciones 24h",
        ];
        const rows = MODELS.map((m) => [
          m.id, m.name, m.algorithm, m.target,
          m.accuracy, m.auc, m.f1, m.status,
          m.trainedAt, m.predictions24h,
        ]);
        return csvResponse(toCsv(headers, rows), "performance-modelos.csv");
      }

      case "RPT-003": {
        // Top entidades con más cambios — bitácora last 100 sorted by tabla
        const qs = new URLSearchParams({ pagina: "1", tamano: "100" });
        const raw = await fastapiFetch<unknown>(
          `/api/v1/auditoria/bitacora?${qs}`,
        );
        const parsed = FastApiBitacoraPagina.parse(raw);
        const entries = parsed.items.map(mapBitacoraEntry);
        const headers = [
          "ID Log", "Proceso", "Tabla Destino", "Estado",
          "Filas Insertadas", "Filas Rechazadas", "Inicio", "Fin",
        ];
        const rows = entries.map((e) => [
          e.idLog, e.nombreProceso, e.tablaDestino, e.estado,
          e.filasInsertadas, e.filasRechazadas,
          e.fechaInicio ?? "", e.fechaFin ?? "",
        ]);
        return csvResponse(toCsv(headers, rows), "top-entidades-cambios.csv");
      }

      case "RPT-004": {
        // Auditoría de aprobaciones — bitácora completa 200 entradas
        const qs = new URLSearchParams({ pagina: "1", tamano: "200" });
        const raw = await fastapiFetch<unknown>(
          `/api/v1/auditoria/bitacora?${qs}`,
        );
        const parsed = FastApiBitacoraPagina.parse(raw);
        const entries = parsed.items.map(mapBitacoraEntry);
        const headers = [
          "ID Log", "Proceso", "Tabla Destino", "Estado",
          "Inicio", "Fin", "Duración (s)", "Filas OK", "Rechazadas",
          "ID Corrida", "Error",
        ];
        const rows = entries.map((e) => [
          e.idLog, e.nombreProceso, e.tablaDestino, e.estado,
          e.fechaInicio ?? "", e.fechaFin ?? "",
          e.duracionSegundos ?? "", e.filasInsertadas, e.filasRechazadas,
          e.idCorrida ?? "", e.mensajeError ?? "",
        ]);
        return csvResponse(toCsv(headers, rows), "auditoria-aprobaciones.csv");
      }

      default:
        return NextResponse.json({ detail: "Reporte no encontrado" }, { status: 404 });
    }
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
