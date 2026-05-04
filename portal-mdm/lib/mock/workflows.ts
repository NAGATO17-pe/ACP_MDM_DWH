export type WorkflowStatus =
  | "pendiente"
  | "en-revision"
  | "aprobado"
  | "rechazado";

export interface Workflow {
  id: string;
  entityId: string;
  entityName: string;
  type: "alta" | "modificacion" | "baja";
  requestedBy: string;
  assignedTo: string;
  status: WorkflowStatus;
  createdAt: string;
  changes: number;
}

export const WORKFLOWS: Workflow[] = [];

export const WORKFLOW_STATUS_LABEL: Record<WorkflowStatus, string> = {
  pendiente: "Pendiente",
  "en-revision": "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};
