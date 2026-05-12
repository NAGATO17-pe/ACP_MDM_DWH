import { z } from "zod";

export const WORKFLOW_STATUSES = ["pendiente", "en-revision", "aprobado", "rechazado"] as const;
export const WORKFLOW_TYPES = ["alta", "modificacion", "baja"] as const;

export const workflowStatusSchema = z.enum(WORKFLOW_STATUSES);
export const workflowTypeSchema = z.enum(WORKFLOW_TYPES);

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export type WorkflowType = (typeof WORKFLOW_TYPES)[number];

export const WORKFLOW_STATUS_LABEL: Record<WorkflowStatus, string> = {
  pendiente: "Pendiente",
  "en-revision": "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export const WORKFLOW_STATUS_VARIANT: Record<
  WorkflowStatus,
  "warning" | "info" | "success" | "destructive"
> = {
  pendiente: "warning",
  "en-revision": "info",
  aprobado: "success",
  rechazado: "destructive",
};

export const WORKFLOW_TYPE_LABEL: Record<WorkflowType, string> = {
  alta: "Alta",
  modificacion: "Modificación",
  baja: "Baja",
};

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
