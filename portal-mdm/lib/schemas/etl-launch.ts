import { z } from "zod";

/**
 * Contratos para lanzar corridas ETL desde el portal.
 *
 * - `FastApi*` describen la respuesta cruda del FastAPI.
 * - El resto son el contrato del portal hacia el cliente (camelCase).
 *
 * Schemas alineados con backend/schemas/etl/ — snake_case ↔ camelCase via mappers.
 */

/* -------------------------------------------------------------------------- */
/* Upstream (FastAPI)                                                         */
/* -------------------------------------------------------------------------- */

export const FastApiFactDisponible = z.object({
  nombre_fact: z.string(),
  orden: z.number().int(),
  tabla_destino: z.string(),
  fuentes_bronce: z.array(z.string()).default([]),
  dependencias: z.array(z.string()).default([]),
  marts: z.array(z.string()).default([]),
  releer_bronce_por_estado: z.boolean(),
  estrategia_rerun: z.string(),
});

export const FastApiCorridaActiva = z.object({
  id_corrida: z.string(),
  iniciado_por: z.string().nullable().optional(),
  estado: z.string(),
  intento_numero: z.number().int().nullable().optional(),
  max_reintentos: z.number().int().nullable().optional(),
  fecha_solicitud: z.string().nullable().optional(),
  fecha_inicio: z.string().nullable().optional(),
  fecha_fin: z.string().nullable().optional(),
  heartbeat_ultimo: z.string().nullable().optional(),
  mensaje_final: z.string().nullable().optional(),
  modo_ejecucion: z.string().default("completo"),
  facts: z.array(z.string()).default([]),
  incluir_dependencias: z.boolean().default(true),
  refrescar_gold: z.boolean().default(true),
  forzar_relectura_bronce: z.boolean().default(true),
});

export const FastApiCorridaIniciada = z.object({
  id_corrida: z.string(),
  id_log: z.number().int().nullable().optional(),
  iniciado_por: z.string(),
  fecha_inicio: z.string(),
  url_stream: z.string(),
  estado: z.string().default("PENDIENTE"),
});

/* -------------------------------------------------------------------------- */
/* Contrato del portal                                                        */
/* -------------------------------------------------------------------------- */

export const FactDisponible = z.object({
  nombre: z.string(),
  orden: z.number().int(),
  tablaDestino: z.string(),
  fuentesBronce: z.array(z.string()),
  dependencias: z.array(z.string()),
  marts: z.array(z.string()),
  estrategiaRerun: z.string(),
  relecturaBroncePorEstado: z.boolean().optional(),
});
export type FactDisponible = z.infer<typeof FactDisponible>;

export const CorridaActiva = z.object({
  id: z.string(),
  estado: z.string(),
  iniciadoPor: z.string().nullable(),
  modoEjecucion: z.string().nullable(),
  facts: z.array(z.string()),
  fechaSolicitud: z.string().nullable(),
  fechaInicio: z.string().nullable(),
  intentoNumero:   z.number().optional(),
  maxReintentos:   z.number().optional(),
  heartbeatUltimo: z.string().nullable().optional(),
  mensajeFinal:    z.string().nullable().optional(),
});
export type CorridaActiva = z.infer<typeof CorridaActiva>;

export const CorridaIniciada = z.object({
  id: z.string(),
  logId: z.number().int().nullable(),
  iniciadoPor: z.string(),
  fechaInicio: z.string(),
  urlStream: z.string(),
  estado: z.string(),
});
export type CorridaIniciada = z.infer<typeof CorridaIniciada>;

export const LanzarCorridaInput = z
  .object({
    comentario: z.string().max(500).nullable().optional(),
    modoEjecucion: z.enum(["completo", "facts"]),
    facts: z.array(z.string()).max(20).nullable().optional(),
    incluirDependencias: z.boolean(),
    refrescarGold: z.boolean(),
    forzarRelecturaBronce: z.boolean(),
  })
  .refine(
    (d) => d.modoEjecucion !== "facts" || (d.facts?.length ?? 0) > 0,
    { message: "Debes seleccionar al menos un fact en modo 'facts'.", path: ["facts"] },
  );
export type LanzarCorridaInput = z.infer<typeof LanzarCorridaInput>;

/* -------------------------------------------------------------------------- */
/* Mappers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mapea del contrato FastAPI al contrato del portal.
 * El backend usa `nombre_fact`; el portal normaliza a `nombre` para consistencia camelCase.
 */
export function mapFactDisponible(
  raw: z.infer<typeof FastApiFactDisponible>,
): FactDisponible {
  return {
    nombre: raw.nombre_fact,
    orden: raw.orden,
    tablaDestino: raw.tabla_destino,
    fuentesBronce: raw.fuentes_bronce,
    dependencias: raw.dependencias,
    marts: raw.marts,
    estrategiaRerun: raw.estrategia_rerun,
    relecturaBroncePorEstado: raw.releer_bronce_por_estado,
  };
}

export function mapCorridaActiva(
  raw: z.infer<typeof FastApiCorridaActiva>,
): CorridaActiva {
  return {
    id: raw.id_corrida,
    estado: raw.estado,
    iniciadoPor: raw.iniciado_por ?? null,
    modoEjecucion: raw.modo_ejecucion ?? null,
    facts: raw.facts,
    fechaSolicitud: raw.fecha_solicitud ?? null,
    fechaInicio: raw.fecha_inicio ?? null,
    intentoNumero:   raw.intento_numero ?? undefined,
    maxReintentos:   raw.max_reintentos ?? undefined,
    heartbeatUltimo: raw.heartbeat_ultimo ?? null,
    mensajeFinal:    raw.mensaje_final ?? null,
  };
}

export function mapCorridaIniciada(
  raw: z.infer<typeof FastApiCorridaIniciada>,
): CorridaIniciada {
  return {
    id: raw.id_corrida,
    logId: raw.id_log ?? null,
    iniciadoPor: raw.iniciado_por,
    fechaInicio: raw.fecha_inicio,
    urlStream: raw.url_stream,
    estado: raw.estado,
  };
}
