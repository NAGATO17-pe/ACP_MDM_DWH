import { z } from "zod";

/**
 * Contratos del módulo Calidad de Datos (MDM.Cuarentena).
 *
 * - `FastApi*` describen las respuestas crudas del backend FastAPI
 *   (snake_case, opcionales en null).
 * - Los schemas sin prefijo son el contrato del portal hacia el cliente:
 *   camelCase y formas predecibles.
 *
 * Los route handlers `/api/cc/quality/*` mapean upstream → downstream.
 */

/* -------------------------------------------------------------------------- */
/* Estados                                                                    */
/* -------------------------------------------------------------------------- */

export const QuarantineStatus = z.enum(["PENDIENTE", "RESUELTO", "DESCARTADO"]);
export type QuarantineStatus = z.infer<typeof QuarantineStatus>;

/* -------------------------------------------------------------------------- */
/* Upstream (FastAPI)                                                         */
/* -------------------------------------------------------------------------- */

export const FastApiQuarantineRecord = z.object({
  tabla_origen: z.string(),
  id_registro: z.string(),
  columna_origen: z.string(),
  valor_raw: z.string(),
  nombre_archivo: z.string().nullable().optional(),
  fecha_ingreso: z.string().nullable().optional(),
  estado: z.string(),
  motivo: z.string().nullable().optional(),
  id_registro_origen: z.number().int().nullable().optional(),
});

export const FastApiQuarantinePage = z.object({
  total: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  tamano: z.number().int().positive(),
  datos: z.array(FastApiQuarantineRecord),
});

export const FastApiQuarantineAction = z.object({
  id_registro: z.string(),
  estado_nuevo: z.string(),
  mensaje: z.string(),
});

/* -------------------------------------------------------------------------- */
/* Contrato del portal                                                        */
/* -------------------------------------------------------------------------- */

export const QuarantineRecord = z.object({
  tablaOrigen: z.string(),
  idRegistro: z.string(),
  columnaOrigen: z.string(),
  valorRaw: z.string(),
  nombreArchivo: z.string().nullable(),
  fechaIngreso: z.string().nullable(),
  estado: QuarantineStatus,
  motivo: z.string().nullable(),
  idRegistroOrigen: z.number().int().nullable(),
});
export type QuarantineRecord = z.infer<typeof QuarantineRecord>;

export const QuarantinePage = z.object({
  total: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  tamano: z.number().int().positive(),
  datos: z.array(QuarantineRecord),
});
export type QuarantinePage = z.infer<typeof QuarantinePage>;

export const QuarantineActionResult = z.object({
  idRegistro: z.string(),
  estadoNuevo: QuarantineStatus,
  mensaje: z.string(),
});
export type QuarantineActionResult = z.infer<typeof QuarantineActionResult>;

/* -------------------------------------------------------------------------- */
/* Mapper upstream → portal                                                   */
/* -------------------------------------------------------------------------- */

function toStatus(raw: string): QuarantineStatus {
  const up = raw.toUpperCase();
  if (up === "PENDIENTE" || up === "RESUELTO" || up === "DESCARTADO") return up;
  return "PENDIENTE";
}

export function mapQuarantineRecord(
  raw: z.infer<typeof FastApiQuarantineRecord>,
): QuarantineRecord {
  return {
    tablaOrigen: raw.tabla_origen,
    idRegistro: raw.id_registro,
    columnaOrigen: raw.columna_origen,
    valorRaw: raw.valor_raw,
    nombreArchivo: raw.nombre_archivo ?? null,
    fechaIngreso: raw.fecha_ingreso ?? null,
    estado: toStatus(raw.estado),
    motivo: raw.motivo ?? null,
    idRegistroOrigen: raw.id_registro_origen ?? null,
  };
}

export function mapQuarantineAction(
  raw: z.infer<typeof FastApiQuarantineAction>,
): QuarantineActionResult {
  return {
    idRegistro: raw.id_registro,
    estadoNuevo: toStatus(raw.estado_nuevo),
    mensaje: raw.mensaje,
  };
}
