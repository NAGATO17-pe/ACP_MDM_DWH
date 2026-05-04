export type AuditAction =
  | "creacion"
  | "modificacion"
  | "aprobacion"
  | "rechazo"
  | "eliminacion"
  | "login";

export interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  action: AuditAction;
  resource: string;
  details: string;
}

export const AUDIT_EVENTS: AuditEvent[] = [];

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  creacion: "Creación",
  modificacion: "Modificación",
  aprobacion: "Aprobación",
  rechazo: "Rechazo",
  eliminacion: "Eliminación",
  login: "Inicio sesión",
};
