import { z } from "zod";

export const workflowStatusSchema = z.enum(["pendiente", "en-revision", "aprobado", "rechazado"]);
export const workflowTypeSchema = z.enum(["alta", "modificacion", "baja"]);

export const workflowSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  entityName: z.string(),
  type: workflowTypeSchema,
  requestedBy: z.string(),
  assignedTo: z.string(),
  status: workflowStatusSchema,
  createdAt: z.string(),
  changes: z.number(),
});

export const workflowListResponseSchema = z.object({
  data: z.array(workflowSchema),
  total: z.number(),
});

export const rejectWorkflowSchema = z.object({
  reason: z.string().min(1, "El motivo es requerido"),
});

export type WorkflowFromApi = z.infer<typeof workflowSchema>;
export type RejectWorkflowInput = z.infer<typeof rejectWorkflowSchema>;
