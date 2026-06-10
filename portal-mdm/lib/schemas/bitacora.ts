import { z } from "zod";

/**
 * Contratos del módulo Bitácora (Auditoria.Log_Carga + Control.Corrida).
 *
 * - `FastApi*` describen las respuestas crudas del backend FastAPI (snake_case).
 * - Los schemas sin prefijo son el contrato del portal hacia el cliente:
 *   camelCase y formas predecibles.
 *
 * Los route handlers `/api/cc/bitacora/*` mapean upstream → downstream.
 */

/* -------------------------------------------------------------------------- */
/* Estados                                                                    */
/* -------------------------------------------------------------------------- */

export const BitacoraEstado = z.enum([
  "OK",
  "ERROR",
  "EN_PROCESO",
  "SKIPPED",
  "TIMEOUT",
]);
export type BitacoraEstado = z.infer<typeof BitacoraEstado>;

export const VENTANAS_BITACORA = [1, 7, 30] as const;
export type VentanaBitacora = (typeof VENTANAS_BITACORA)[number];

/* -------------------------------------------------------------------------- */
/* Upstream (FastAPI)                                                         */
/* -------------------------------------------------------------------------- */

export const FastApiLogCarga = z.object({
  id_log: z.number().int(),
  nombre_proceso: z.string(),
  tabla_destino: z.string(),
  nombre_archivo: z.string().nullable().optional(),
  fecha_inicio: z.string().nullable().optional(),
  fecha_fin: z.string().nullable().optional(),
  estado: z.string(),
  filas_insertadas: z.number().int().nonnegative(),
  filas_rechazadas: z.number().int().nonnegative(),
  duracion_segundos: z.number().int().nullable().optional(),
  mensaje_error: z.string().nullable().optional(),
  id_corrida: z.string().nullable().optional(),
});

export const FastApiBitacoraPagina = z.object({
  items: z.array(FastApiLogCarga),
  total: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  tamano: z.number().int().positive(),
});

export const FastApiResumenBitacora = z.object({
  ventana_dias: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  ok: z.number().int().nonnegative(),
  errores: z.number().int().nonnegative(),
  en_proceso: z.number().int().nonnegative(),
  filas_ok: z.number().int().nonnegative(),
  filas_rechazadas: z.number().int().nonnegative(),
  tasa_exito_pct: z.number().nonnegative(),
});

/* -------------------------------------------------------------------------- */
/* Contrato del portal                                                        */
/* -------------------------------------------------------------------------- */

export const BitacoraEntry = z.object({
  idLog: z.number().int(),
  nombreProceso: z.string(),
  tablaDestino: z.string(),
  nombreArchivo: z.string().nullable(),
  fechaInicio: z.string().nullable(),
  fechaFin: z.string().nullable(),
  estado: z.string(),
  filasInsertadas: z.number().int().nonnegative(),
  filasRechazadas: z.number().int().nonnegative(),
  duracionSegundos: z.number().int().nullable(),
  mensajeError: z.string().nullable(),
  idCorrida: z.string().nullable(),
});
export type BitacoraEntry = z.infer<typeof BitacoraEntry>;

export const BitacoraPage = z.object({
  items: z.array(BitacoraEntry),
  total: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  tamano: z.number().int().positive(),
});
export type BitacoraPage = z.infer<typeof BitacoraPage>;

export const BitacoraResumen = z.object({
  ventanaDias: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  ok: z.number().int().nonnegative(),
  errores: z.number().int().nonnegative(),
  enProceso: z.number().int().nonnegative(),
  filasOk: z.number().int().nonnegative(),
  filasRechazadas: z.number().int().nonnegative(),
  tasaExitoPct: z.number().nonnegative(),
});
export type BitacoraResumen = z.infer<typeof BitacoraResumen>;

/* -------------------------------------------------------------------------- */
/* Mappers                                                                    */
/* -------------------------------------------------------------------------- */

export function mapBitacoraEntry(
  raw: z.infer<typeof FastApiLogCarga>,
): BitacoraEntry {
  return {
    idLog: raw.id_log,
    nombreProceso: raw.nombre_proceso,
    tablaDestino: raw.tabla_destino,
    nombreArchivo: raw.nombre_archivo ?? null,
    fechaInicio: raw.fecha_inicio ?? null,
    fechaFin: raw.fecha_fin ?? null,
    estado: raw.estado,
    filasInsertadas: raw.filas_insertadas,
    filasRechazadas: raw.filas_rechazadas,
    duracionSegundos: raw.duracion_segundos ?? null,
    mensajeError: raw.mensaje_error ?? null,
    idCorrida: raw.id_corrida ?? null,
  };
}

export function mapBitacoraPage(
  raw: z.infer<typeof FastApiBitacoraPagina>,
): BitacoraPage {
  return {
    items: raw.items.map(mapBitacoraEntry),
    total: raw.total,
    pagina: raw.pagina,
    tamano: raw.tamano,
  };
}

export function mapBitacoraResumen(
  raw: z.infer<typeof FastApiResumenBitacora>,
): BitacoraResumen {
  return {
    ventanaDias: raw.ventana_dias,
    total: raw.total,
    ok: raw.ok,
    errores: raw.errores,
    enProceso: raw.en_proceso,
    filasOk: raw.filas_ok,
    filasRechazadas: raw.filas_rechazadas,
    tasaExitoPct: raw.tasa_exito_pct,
  };
}

/* -------------------------------------------------------------------------- */
/* Inputs (query params)                                                      */
/* -------------------------------------------------------------------------- */

export const BitacoraListInput = z.object({
  pagina: z.number().int().positive().default(1),
  tamano: z.number().int().min(1).max(200).default(50),
  estado: z.array(BitacoraEstado).optional(),
  tablaDestino: z.string().trim().min(1).max(120).optional(),
  desde: z.string().datetime().optional(),
  hasta: z.string().datetime().optional(),
  idCorrida: z.string().trim().min(1).max(36).optional(),
});
export type BitacoraListInput = z.infer<typeof BitacoraListInput>;
