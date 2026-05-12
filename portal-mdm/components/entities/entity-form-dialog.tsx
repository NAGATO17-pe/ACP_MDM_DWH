"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  ENTITY_TYPE_LABEL,
  createEntitySchema,
  type CreateEntityInput,
  type MdmEntity,
} from "@/lib/schemas/entities";
import { createEntity, updateEntity } from "@/lib/api/entities";
import { getErrorMessage } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface EntityFormDialogProps {
  open: boolean;
  /** When provided, the dialog enters edit mode for that entity. */
  editTarget: MdmEntity | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Crear / editar entidad maestra.
 * Maneja react-hook-form + Zod, mutations TanStack Query y toasts.
 */
export function EntityFormDialog({ open, editTarget, onOpenChange }: EntityFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEntityInput>({
    resolver: zodResolver(createEntitySchema),
    defaultValues: { name: "", type: "cliente", owner: "" },
  });

  // Sync form with the active editTarget whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    if (editTarget) {
      reset({ name: editTarget.name, type: editTarget.type, owner: editTarget.owner });
    } else {
      reset({ name: "", type: "cliente", owner: "" });
    }
  }, [open, editTarget, reset]);

  const createMutation = useMutation({
    mutationFn: (data: CreateEntityInput) => createEntity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.entities() });
      toast({ title: "Entidad creada", variant: "success" });
      onOpenChange(false);
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
      onOpenChange(false);
    },
    onError: (err) => {
      toast({ title: "Error al actualizar", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: CreateEntityInput) {
    if (editTarget) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : editTarget ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
