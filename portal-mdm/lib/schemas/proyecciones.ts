import { z } from "zod";

export const MatrizInputs = z.record(
  z.string(),
  z.record(z.string(), z.number().min(0).max(1).nullable()),
);
export type MatrizInputs = z.infer<typeof MatrizInputs>;

export const FechasDisponibles = z.object({ fechas: z.array(z.number().int()) });
export type FechasDisponibles = z.infer<typeof FechasDisponibles>;

export const Combinacion = z.object({
  Fundo: z.string(),
  Modulo: z.string(),
  Variedad: z.string(),
  Condicion: z.string(),
});
export type Combinacion = z.infer<typeof Combinacion>;

export const ProyeccionSemanal = z.object({
  semana: z.number().int(),
  semana_label: z.string(),
  fecha_semana: z.string(),
  kg_proyectados: z.number(),
  kg_pesimista: z.number().default(0),
  kg_optimista: z.number().default(0),
  kg_anterior: z.number(),
  pct_variacion: z.number(),
  tendencia: z.string(),
});
export type ProyeccionSemanal = z.infer<typeof ProyeccionSemanal>;

export const ProyeccionKpis = z.object({
  total_base: z.number(),
  total_opt: z.number(),
  total_pes: z.number(),
  variedad_top: z.string(),
  total_plantas: z.number(),
  kg_por_planta: z.number(),
  unidades_cubiertas: z.number().int(),
  unidades_totales: z.number().int(),
});
export type ProyeccionKpis = z.infer<typeof ProyeccionKpis>;

export const ProyeccionDetalle = z.object({
  fundo: z.string(),
  condicion: z.string(),
  certificacion: z.string(),
  modulo: z.coerce.number(),
  turno: z.coerce.number(),
  valvula: z.coerce.string(),
  variedad: z.string(),
  semana: z.number().int(),
  semana_label: z.string(),
  kg_base: z.number(),
  kg_pesimista: z.number(),
  kg_optimista: z.number(),
});
export type ProyeccionDetalle = z.infer<typeof ProyeccionDetalle>;

export const RespuestaProyeccion = z.object({
  df_semanal: z.array(ProyeccionSemanal),
  kpis: ProyeccionKpis.partial().passthrough(),
  df_detalle: z.array(ProyeccionDetalle.passthrough()).nullable().default([]),
});
export type RespuestaProyeccion = z.infer<typeof RespuestaProyeccion>;

export const EjecutarProyeccionInput = z.object({
  id_tiempo: z.number().int(),
  matriz_inputs: MatrizInputs.optional(),
  margen_pesimista: z.number().positive().default(0.9906),
  margen_optimista: z.number().positive().default(1.0107),
  modulo: z.number().int().optional(),
  variedad: z.string().optional(),
  condicion: z.string().optional(),
  fundo: z.string().optional(),
});
export type EjecutarProyeccionInput = z.infer<typeof EjecutarProyeccionInput>;
