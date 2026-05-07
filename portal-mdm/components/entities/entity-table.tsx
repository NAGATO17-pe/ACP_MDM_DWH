"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Database, Pencil, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ENTITY_TYPE_LABEL,
  createEntitySchema,
  type CreateEntityInput,
  type EntityStatus,
  type EntityType,
  type MdmEntity,
} from "@/lib/schemas/entities";
import { createEntity, updateEntity } from "@/lib/api/entities";
import { getErrorMessage } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<
  EntityStatus,
  "success" | "warning" | "destructive" | "default"
> = {
  validado: "success",
  pendiente: "warning",
  rechazado: "destructive",
  borrador: "default",
};

const TABS: Array<{ value: EntityType | "all"; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "cliente", label: ENTITY_TYPE_LABEL.cliente },
  { value: "producto", label: ENTITY_TYPE_LABEL.producto },
  { value: "proveedor", label: ENTITY_TYPE_LABEL.proveedor },
  { value: "ubicacion", label: ENTITY_TYPE_LABEL.ubicacion },
];

function buildColumns(
  readOnly: boolean,
  onEdit: (entity: MdmEntity) => void,
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
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
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
        <Badge variant={STATUS_VARIANT[row.original.status]}>
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

  if (!readOnly) {
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

interface EntityTableProps {
  data: MdmEntity[];
  /** Oculta el botón de "Nueva entidad" y acciones de escritura */
  readOnly?: boolean;
}

export function EntityTable({ data, readOnly = false }: EntityTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [active, setActive] = React.useState<EntityType | "all">("all");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<MdmEntity | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEntityInput>({
    resolver: zodResolver(createEntitySchema),
    defaultValues: { name: "", type: "cliente", owner: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateEntityInput) => createEntity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.entities() });
      toast({ title: "Entidad creada", variant: "success" });
      setModalOpen(false);
      reset();
    },
    onError: (err) => {
      toast({ title: "Error al crear", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateEntityInput) => updateEntity(editTarget!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.entities() });
      toast({ title: "Entidad actualizada", variant: "success" });
      setModalOpen(false);
      setEditTarget(null);
      reset();
    },
    onError: (err) => {
      toast({ title: "Error al actualizar", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const openCreate = React.useCallback(() => {
    setEditTarget(null);
    reset({ name: "", type: "cliente", owner: "" });
    setModalOpen(true);
  }, [reset]);

  const openEdit = React.useCallback(
    (entity: MdmEntity) => {
      setEditTarget(entity);
      reset({ name: entity.name, type: entity.type, owner: entity.owner });
      setModalOpen(true);
    },
    [reset],
  );

  function onSubmit(data: CreateEntityInput) {
    if (editTarget) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const columns = React.useMemo(
    () => buildColumns(readOnly, openEdit),
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

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setModalOpen(false);
            setEditTarget(null);
            reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar entidad" : "Nueva entidad"}</DialogTitle>
            <DialogDescription>
              {editTarget
                ? `Modifica los datos de "${editTarget.name}".`
                : "Completa los campos para registrar una nueva entidad maestra."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entity-name">Nombre</Label>
              <Input
                id="entity-name"
                placeholder="Ej: Cliente Corporativo XYZ"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-[var(--color-destructive)]">{errors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entity-type">Tipo</Label>
              <select
                id="entity-type"
                {...register("type")}
                className={cn(
                  "h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                )}
              >
                <option value="cliente">{ENTITY_TYPE_LABEL.cliente}</option>
                <option value="producto">{ENTITY_TYPE_LABEL.producto}</option>
                <option value="proveedor">{ENTITY_TYPE_LABEL.proveedor}</option>
                <option value="ubicacion">{ENTITY_TYPE_LABEL.ubicacion}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entity-owner">Responsable</Label>
              <Input
                id="entity-owner"
                placeholder="Ej: Ana García"
                {...register("owner")}
              />
              {errors.owner && (
                <p className="text-xs text-[var(--color-destructive)]">{errors.owner.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setModalOpen(false); setEditTarget(null); reset(); }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : editTarget ? "Actualizar" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
