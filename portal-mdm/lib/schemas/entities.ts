import { z } from "zod";

export const entityStatusSchema = z.enum(["validado", "pendiente", "rechazado", "borrador"]);
export const entityTypeSchema = z.enum(["cliente", "producto", "proveedor", "ubicacion"]);

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

export type MdmEntityFromApi = z.infer<typeof mdmEntitySchema>;
export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
