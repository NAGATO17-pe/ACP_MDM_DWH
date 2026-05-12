"use client";

import * as React from "react";
import { Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ENTITY_TYPE_LABEL,
  type EntityType,
  type MdmEntity,
} from "@/lib/schemas/entities";
import { cn } from "@/lib/utils";
import { buildEntityColumns } from "./entity-columns";
import { EntityFormDialog } from "./entity-form-dialog";

const TABS: Array<{ value: EntityType | "all"; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "cliente", label: ENTITY_TYPE_LABEL.cliente },
  { value: "producto", label: ENTITY_TYPE_LABEL.producto },
  { value: "proveedor", label: ENTITY_TYPE_LABEL.proveedor },
  { value: "ubicacion", label: ENTITY_TYPE_LABEL.ubicacion },
];

interface EntityTableProps {
  data: MdmEntity[];
  /** Oculta el botón de "Nueva entidad" y acciones de escritura */
  readOnly?: boolean;
}

export function EntityTable({ data, readOnly = false }: EntityTableProps) {
  const [active, setActive] = React.useState<EntityType | "all">("all");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<MdmEntity | null>(null);

  const openCreate = React.useCallback(() => {
    setEditTarget(null);
    setModalOpen(true);
  }, []);

  const openEdit = React.useCallback((entity: MdmEntity) => {
    setEditTarget(entity);
    setModalOpen(true);
  }, []);

  const handleOpenChange = React.useCallback((open: boolean) => {
    setModalOpen(open);
    if (!open) setEditTarget(null);
  }, []);

  const columns = React.useMemo(
    () => buildEntityColumns(readOnly, openEdit),
    [readOnly, openEdit],
  );

  const filtered = React.useMemo(() => {
    if (active === "all") return data;
    return data.filter((e) => e.type === active);
  }, [active, data]);

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filtro por tipo de entidad"
            className="bg-surface inline-flex h-10 items-center gap-1 rounded-md border border-[var(--color-border)] p-1"
          >
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active === tab.value}
                onClick={() => setActive(tab.value)}
                className={cn(
                  "h-8 rounded-md px-3 text-sm font-medium transition",
                  active === tab.value
                    ? "bg-[var(--color-surface-2)] text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {!readOnly && (
            <Button onClick={openCreate}>
              <Plus aria-hidden className="h-4 w-4" />
              Nueva entidad
            </Button>
          )}
        </div>

        {data.length === 0 ? (
          <EmptyState
            icon={Database}
            title="Sin entidades"
            description="No se encontraron entidades maestras para los filtros aplicados."
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            searchPlaceholder="Buscar por nombre, código u responsable…"
            emptyMessage="No hay entidades para los filtros aplicados."
          />
        )}
      </div>

      <EntityFormDialog
        open={modalOpen}
        editTarget={editTarget}
        onOpenChange={handleOpenChange}
      />
    </>
  );
}
