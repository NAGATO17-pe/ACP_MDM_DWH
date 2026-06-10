"use client";

/**
 * components/data-table/data-view.tsx
 * ====================================
 * Wrapper composable sobre `<DataTable>` para los casos comunes de
 * tabla "página": toolbar de búsqueda + filtros + export CSV opcional
 * + tabla. Es aditivo — quien necesita más control sigue usando
 * `<DataTable>` directo.
 *
 * No persiste estado en URL por sí mismo — pasa el `useTableQueryState`
 * como `queryState` si quieres búsqueda compartible.
 */

import * as React from "react";
import { Download } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExportConfig<TData> {
  filename: string;
  /** Función que aplana cada fila a un objeto CSV-ready. */
  toRow: (data: TData) => Record<string, string | number | null | undefined>;
}

interface DataViewProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Acciones a la derecha del search bar (botones, filtros, etc.). */
  toolbar?: React.ReactNode;
  /** Slot encima de la tabla para filtros adicionales (chips, selects, etc.). */
  filters?: React.ReactNode;
  /** Habilita botón "Exportar CSV" en la toolbar. */
  export?: ExportConfig<TData>;
  searchPlaceholder?: string;
  searchKey?: keyof TData & string;
  emptyMessage?: string;
  className?: string;
}

export function DataView<TData, TValue>({
  columns,
  data,
  toolbar,
  filters,
  export: exportCfg,
  searchPlaceholder,
  searchKey,
  emptyMessage,
  className,
}: DataViewProps<TData, TValue>) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {(toolbar || exportCfg) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {toolbar}
          {exportCfg ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(data, exportCfg)}
              disabled={data.length === 0}
            >
              <Download aria-hidden className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
          ) : null}
        </div>
      )}

      {filters}

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder={searchPlaceholder}
        searchKey={searchKey}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}

function exportToCsv<TData>(rows: TData[], cfg: ExportConfig<TData>) {
  if (rows.length === 0) return;
  const records = rows.map(cfg.toRow);
  const headers = Object.keys(records[0]);
  const lines = [
    headers.join(","),
    ...records.map((r) =>
      headers
        .map((h) => csvCell(r[h] ?? ""))
        .join(","),
    ),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = cfg.filename.endsWith(".csv") ? cfg.filename : `${cfg.filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
