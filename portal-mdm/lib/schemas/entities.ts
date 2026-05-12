import { z } from "zod";

export const ENTITY_STATUSES = ["validado", "pendiente", "rechazado", "borrador"] as const;
export const ENTITY_TYPES = ["cliente", "producto", "proveedor", "ubicacion"] as const;

export const entityStatusSchema = z.enum(ENTITY_STATUSES);
export const entityTypeSchema = z.enum(ENTITY_TYPES);

export type EntityStatus = (typeof ENTITY_STATUSES)[number];
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  cliente: "Clientes",
  producto: "Productos",
  proveedor: "Proveedores",
  ubicacion: "Ubicaciones",
};

export const ENTITY_STATUS_VARIANT: Record<
  EntityStatus,
  "success" | "warning" | "destructive" | "default"
> = {
  validado: "success",
  pendiente: "warning",
  rechazado: "destructive",
  borrador: "default",
};

export const mdmEntitySchema = z.object({
  id: z.string(),
  type: entityTypeSchema,
  name: z.string(),
  code: z.string(),
  owner: z.string(),
  status: entityStatusSchema,
  completeness: z.number().min(0).max(100),
  updatedAt: z.string(),
});

export const entityListResponseSchema = z.object({
  data: z.array(mdmEntitySchema),
  total: z.number(),
});

export const createEntitySchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  type: entityTypeSchema,
  owner: z.string().min(1, "Responsable requerido"),
});

export const updateEntitySchema = createEntitySchema.partial();

export type MdmEntity = z.infer<typeof mdmEntitySchema>;
/** @deprecated usa `MdmEntity` */
export type MdmEntityFromApi = MdmEntity;
export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
