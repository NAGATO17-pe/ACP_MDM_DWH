"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ENTITY_STATUS_VARIANT,
  ENTITY_TYPE_LABEL,
  type MdmEntity,
} from "@/lib/schemas/entities";
import { formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Build the column definitions for the entity DataTable.
 * Pass `onEdit` (and set `readOnly: false`) to add an "edit" action column.
 */
export function buildEntityColumns(
  readOnly: boolean,
  onEdit?: (entity: MdmEntity) => void,
): ColumnDef<MdmEntity>[] {
  const base: ColumnDef<MdmEntity>[] = [
    {
      accessorKey: "code",
      header: "Código",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[var(--color-text-muted)]">
          {row.original.code}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => (
        <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          {ENTITY_TYPE_LABEL[row.original.type]}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={ENTITY_STATUS_VARIANT[row.original.status]}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "completeness",
      header: "Completitud",
      cell: ({ row }) => {
        const v = row.original.completeness;
        const tone = v >= 90 ? "success" : v >= 80 ? "warning" : "destructive";
        return (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "tabular-nums w-12 text-right text-xs font-semibold",
                tone === "success" && "text-[var(--color-success)]",
                tone === "warning" && "text-[var(--color-warning)]",
                tone === "destructive" && "text-[var(--color-destructive)]",
              )}
            >
              {formatPercent(v, 0)}
            </span>
            <div className="bg-[var(--color-surface-2)] h-1.5 w-24 overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full",
                  tone === "success" && "bg-[var(--color-success)]",
                  tone === "warning" && "bg-[var(--color-warning)]",
                  tone === "destructive" && "bg-[var(--color-destructive)]",
                )}
                style={{ width: `${v}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "owner",
      header: "Responsable",
    },
    {
      accessorKey: "updatedAt",
      header: "Actualizado",
      cell: ({ row }) => (
        <span className="tabular-nums text-xs text-[var(--color-text-muted)]">
          {formatDate(row.original.updatedAt)}
        </span>
      ),
    },
  ];

  if (!readOnly && onEdit) {
    base.push({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          type="button"
          aria-label={`Editar ${row.original.name}`}
          onClick={() => onEdit(row.original)}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ),
    });
  }

  return base;
}
