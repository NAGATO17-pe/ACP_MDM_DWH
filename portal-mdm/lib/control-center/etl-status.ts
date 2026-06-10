/**
 * Mapeo central de estados de corridas ETL del backend FastAPI.
 *
 * Estados terminales reales emitidos por `servicios/servicio_etl.py`:
 *   - "OK"        → éxito
 *   - "ERROR"     → fallo
 *   - "CANCELADO" → cancelado por usuario o sistema
 *   - "TIMEOUT"   → fallo por timeout del runner
 *
 * Estados no-terminales: "PENDIENTE", "EJECUTANDO".
 *
 * Mantén este archivo como única fuente de verdad — los route handlers
 * `app/api/cc/*` lo consumen para clasificar consistentemente.
 */

export const TERMINAL_OK = new Set(["OK", "EXITO", "EXITOSO"]);
export const TERMINAL_ERR = new Set(["ERROR", "TIMEOUT", "FALLO", "FAILED"]);
export const TERMINAL_CANCEL = new Set(["CANCELADO", "CANCELLED"]);
export const RUNNING = new Set(["EJECUTANDO", "EN_PROCESO", "RUNNING"]);
export const PENDING = new Set(["PENDIENTE", "QUEUED"]);

export type CorridaStatus =
  | "success"
  | "running"
  | "failed"
  | "queued"
  | "canceled";

export function mapCorridaStatus(estado: string): CorridaStatus {
  const e = estado.toUpperCase();
  if (TERMINAL_OK.has(e)) return "success";
  if (TERMINAL_ERR.has(e)) return "failed";
  if (TERMINAL_CANCEL.has(e)) return "canceled";
  if (RUNNING.has(e)) return "running";
  if (PENDING.has(e)) return "queued";
  console.warn(`[mapCorridaStatus] Estado desconocido: "${estado}" — clasificado como "failed"`);
  return "failed";
}

export function isErrored(estado: string): boolean {
  return TERMINAL_ERR.has(estado.toUpperCase());
}

export function isSuccess(estado: string): boolean {
  return TERMINAL_OK.has(estado.toUpperCase());
}

export function isTerminal(estado: string): boolean {
  const e = estado.toUpperCase();
  return TERMINAL_OK.has(e) || TERMINAL_ERR.has(e) || TERMINAL_CANCEL.has(e);
}
