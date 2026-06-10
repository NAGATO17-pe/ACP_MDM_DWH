import { z } from "zod";

/**
 * Contratos del Control Center.
 *
 * Estos schemas describen la respuesta de los route handlers
 * `/api/cc/*` (que a su vez consumen el FastAPI real y derivan/agregan
 * cuando hace falta).
 */

export const StatusLevel = z.enum(["ok", "warning", "critical"]);
export type StatusLevel = z.infer<typeof StatusLevel>;

export const SystemHealth = z.object({
  etl: StatusLevel,
  dwh: StatusLevel,
  quality: StatusLevel,
  alerts: StatusLevel,
  activeCritical: z.number().int().nonnegative(),
  activeWarnings: z.number().int().nonnegative(),
  platform: StatusLevel,
  updatedAt: z.string(),
});
export type SystemHealth = z.infer<typeof SystemHealth>;

/** Una corrida ETL, derivada de Auditoria.Log_Carga vía /api/v1/etl/corridas */
export const EtlRun = z.object({
  id: z.string(),
  /** UUID de Control.Corrida cuando exista — habilita link al detalle. */
  corridaId: z.string().nullable(),
  name: z.string(),
  status: z.enum(["success", "running", "failed", "queued", "canceled"]),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  durationSec: z.number().nullable(),
  rowsProcessed: z.number().int().nonnegative().nullable(),
  rowsRejected: z.number().int().nonnegative().nullable(),
  table: z.string().nullable(),
  error: z.string().nullable(),
});
export type EtlRun = z.infer<typeof EtlRun>;

/** Paso individual dentro de una corrida (Control.Corrida_Paso). */
export const CorridaPaso = z.object({
  idPaso: z.number().int(),
  nombre: z.string(),
  orden: z.number().int(),
  status: z.enum(["success", "running", "failed", "queued", "canceled"]),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  durationSec: z.number().nullable(),
  error: z.string().nullable(),
});
export type CorridaPaso = z.infer<typeof CorridaPaso>;

/** Detalle completo de una corrida ETL. */
export const CorridaDetail = z.object({
  id: z.string(),
  status: z.enum(["success", "running", "failed", "queued", "canceled"]),
  startedBy: z.string(),
  comment: z.string().nullable(),
  attempt: z.number().int(),
  maxAttempts: z.number().int(),
  requestedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  durationSec: z.number().nullable(),
  runnerPid: z.number().int().nullable(),
  lastHeartbeat: z.string().nullable(),
  timeoutSec: z.number().int(),
  finalMessage: z.string().nullable(),
  logId: z.number().int().nullable(),
  mode: z.string(),
  facts: z.array(z.string()),
  withDependencies: z.boolean(),
  refreshGold: z.boolean(),
  forceBronzeReread: z.boolean(),
  pasos: z.array(CorridaPaso),
});
export type CorridaDetail = z.infer<typeof CorridaDetail>;

export const EtlTrendPoint = z.object({
  date: z.string(), // MM-DD
  success: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});
export type EtlTrendPoint = z.infer<typeof EtlTrendPoint>;

/**
 * Calidad de datos — derivada de MDM.Cuarentena (resumen) y log de cargas.
 * El backend solo expone: total, pendientes, resueltos, descartados.
 * Score = (resueltos + descartados) / total * 100.
 */
export const QualityKpis = z.object({
  total: z.number().int().nonnegative(),
  pendientes: z.number().int().nonnegative(),
  resueltos: z.number().int().nonnegative(),
  descartados: z.number().int().nonnegative(),
  resolutionRate: z.number().min(0).max(100),
});
export type QualityKpis = z.infer<typeof QualityKpis>;

/**
 * Estado del DWH — derivado del catálogo de facts (/etl/facts) y del
 * log de cargas reciente. No exponemos storageBytes/growth porque el
 * backend no los emite.
 */
export const DwhState = z.object({
  tables: z.number().int().nonnegative(),
  rowsLast24h: z.number().int().nonnegative(),
  rejectedLast24h: z.number().int().nonnegative(),
  failedLast24h: z.number().int().nonnegative(),
  lastSuccessAt: z.string().nullable(),
});
export type DwhState = z.infer<typeof DwhState>;

export const Alert = z.object({
  id: z.string(),
  severity: z.enum(["critical", "warning", "info"]),
  source: z.string(),
  message: z.string(),
  createdAt: z.string(),
  acknowledged: z.boolean(),
  ackedBy: z.string().nullable().optional(),
  ackedAt: z.string().nullable().optional(),
  ackComment: z.string().nullable().optional(),
});
export type Alert = z.infer<typeof Alert>;

/**
 * Shape upstream del backend para los registros de MDM.Alerta_Ack.
 */
export const FastApiAckAlerta = z.object({
  id_alerta: z.string(),
  usuario_dni: z.string(),
  fecha_ack: z.string(),
  comentario: z.string().nullable().optional(),
});
export type FastApiAckAlerta = z.infer<typeof FastApiAckAlerta>;

export const FastApiAccionAck = z.object({
  id_alerta: z.string(),
  accion: z.enum(["ack", "unack"]),
  mensaje: z.string(),
});
export type FastApiAccionAck = z.infer<typeof FastApiAccionAck>;

export const ActivityEvent = z.object({
  id: z.string(),
  at: z.string(),
  actor: z.string().nullable(),
  kind: z.enum(["etl", "catalog", "auth", "error", "config"]),
  message: z.string(),
});
export type ActivityEvent = z.infer<typeof ActivityEvent>;

/* -------------------------------------------------------------------------- */
/* Shapes upstream (FastAPI) — usados internamente por los route handlers     */
/* -------------------------------------------------------------------------- */

export const FastApiLogCarga = z.object({
  id_log: z.number().int(),
  nombre_proceso: z.string(),
  tabla_destino: z.string(),
  nombre_archivo: z.string().nullable().optional(),
  fecha_inicio: z.string().nullable().optional(),
  fecha_fin: z.string().nullable().optional(),
  estado: z.string(),
  filas_insertadas: z.number().int(),
  filas_rechazadas: z.number().int(),
  duracion_segundos: z.number().int().nullable().optional(),
  mensaje_error: z.string().nullable().optional(),
  id_corrida: z.string().nullable().optional(),
});
export type FastApiLogCarga = z.infer<typeof FastApiLogCarga>;

export const FastApiPasoCorrida = z.object({
  id_paso: z.number().int(),
  id_corrida: z.string(),
  nombre_paso: z.string(),
  orden: z.number().int(),
  estado: z.string(),
  fecha_inicio: z.string().nullable().optional(),
  fecha_fin: z.string().nullable().optional(),
  mensaje_error: z.string().nullable().optional(),
});

export const FastApiDetalleCorrida = z.object({
  id_corrida: z.string(),
  iniciado_por: z.string(),
  comentario: z.string().nullable().optional(),
  estado: z.string(),
  intento_numero: z.number().int(),
  max_reintentos: z.number().int(),
  fecha_solicitud: z.string().nullable().optional(),
  fecha_inicio: z.string().nullable().optional(),
  fecha_fin: z.string().nullable().optional(),
  pid_runner: z.number().int().nullable().optional(),
  heartbeat_ultimo: z.string().nullable().optional(),
  timeout_segundos: z.number().int(),
  mensaje_final: z.string().nullable().optional(),
  id_log_auditoria: z.number().int().nullable().optional(),
  modo_ejecucion: z.string(),
  facts: z.array(z.string()).default([]),
  incluir_dependencias: z.boolean(),
  refrescar_gold: z.boolean(),
  forzar_relectura_bronce: z.boolean(),
  pasos: z.array(FastApiPasoCorrida).default([]),
});

export const FastApiFact = z.object({
  nombre_fact: z.string(),
  orden: z.number().int(),
  tabla_destino: z.string(),
  fuentes_bronce: z.array(z.string()),
  dependencias: z.array(z.string()),
  marts: z.array(z.string()),
  releer_bronce_por_estado: z.boolean(),
  estrategia_rerun: z.string(),
});

export const FastApiResumenCuarentena = z.object({
  total: z.number().int().nonnegative(),
  pendientes: z.number().int().nonnegative(),
  resueltos: z.number().int().nonnegative(),
  descartados: z.number().int().nonnegative(),
});

export const FastApiHealth = z.object({
  servicio: z.string(),
  version: z.string(),
  entorno: z.string().optional(),
  estado: z.string(),
  base_datos: z.unknown().optional(),
  timestamp: z.string(),
});

/** Respuesta agregada del endpoint /api/v1/etl/fallos-recientes. */
export const FastApiFallosRecientes = z.object({
  fallos: z.number().int().nonnegative(),
  ultimo_fallo_fecha: z.string().nullable(),
  ultimo_fallo_tabla: z.string().nullable(),
});
export type FastApiFallosRecientes = z.infer<typeof FastApiFallosRecientes>;
