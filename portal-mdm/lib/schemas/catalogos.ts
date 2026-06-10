import { z } from "zod";

/**
 * Contratos del módulo Catálogos (MDM + Silver del DWH).
 *
 * - `FastApi*` describen las respuestas crudas del backend (snake_case).
 * - Los schemas sin prefijo son el contrato del portal hacia el cliente
 *   (camelCase + valores ya legibles).
 *
 * Los route handlers `/api/cc/catalogos/*` mapean upstream → downstream.
 */

/* -------------------------------------------------------------------------- */
/* Wrapper paginado upstream                                                  */
/* -------------------------------------------------------------------------- */

const fastApiPagina = <T extends z.ZodTypeAny>(filaSchema: T) =>
  z.object({
    total: z.number().int().nonnegative(),
    pagina: z.number().int().positive(),
    tamano: z.number().int().positive(),
    datos: z.array(filaSchema),
  });

export interface CatalogoPagina<T> {
  total: number;
  pagina: number;
  tamano: number;
  datos: T[];
}

/* -------------------------------------------------------------------------- */
/* Variedades MDM (MDM.Catalogo_Variedades)                                   */
/* -------------------------------------------------------------------------- */

export const FastApiVariedadMdm = z.object({
  nombre_canonico: z.string(),
  breeder: z.string().nullable().optional(),
  es_activa: z.boolean(),
});
export const FastApiVariedadMdmPagina = fastApiPagina(FastApiVariedadMdm);

export const VariedadMdm = z.object({
  nombreCanonico: z.string(),
  breeder: z.string().nullable(),
  esActiva: z.boolean(),
});
export type VariedadMdm = z.infer<typeof VariedadMdm>;

export function mapVariedadMdm(
  r: z.infer<typeof FastApiVariedadMdm>,
): VariedadMdm {
  return {
    nombreCanonico: r.nombre_canonico,
    breeder: r.breeder ?? null,
    esActiva: r.es_activa,
  };
}

/* -------------------------------------------------------------------------- */
/* Variedades DWH (Silver.Dim_Variedad)                                       */
/* -------------------------------------------------------------------------- */

export const FastApiVariedadDim = z.object({
  id_variedad: z.number().int(),
  nombre_variedad: z.string(),
  breeder: z.string().nullable().optional(),
  es_activa: z.boolean(),
  fecha_creacion: z.string().nullable().optional(),
  fecha_modificacion: z.string().nullable().optional(),
});
export const FastApiVariedadDimPagina = fastApiPagina(FastApiVariedadDim);

export const VariedadDim = z.object({
  idVariedad: z.number().int(),
  nombreVariedad: z.string(),
  breeder: z.string().nullable(),
  esActiva: z.boolean(),
  fechaCreacion: z.string().nullable(),
  fechaModificacion: z.string().nullable(),
});
export type VariedadDim = z.infer<typeof VariedadDim>;

export function mapVariedadDim(
  r: z.infer<typeof FastApiVariedadDim>,
): VariedadDim {
  return {
    idVariedad: r.id_variedad,
    nombreVariedad: r.nombre_variedad,
    breeder: r.breeder ?? null,
    esActiva: r.es_activa,
    fechaCreacion: r.fecha_creacion ?? null,
    fechaModificacion: r.fecha_modificacion ?? null,
  };
}

export const CrearVariedadInput = z.object({
  nombreVariedad: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(150, "Máximo 150 caracteres"),
  breeder: z.string().trim().max(100).optional().or(z.literal("")),
});
export type CrearVariedadInput = z.infer<typeof CrearVariedadInput>;

export const FastApiOperacionVariedad = z.object({
  ok: z.boolean(),
  mensaje: z.string(),
  dato: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type FastApiOperacionVariedad = z.infer<typeof FastApiOperacionVariedad>;

/* -------------------------------------------------------------------------- */
/* Geografía (Silver.Dim_Geografia + JOINs a catálogos)                       */
/* -------------------------------------------------------------------------- */

export const FastApiGeografia = z.object({
  fundo: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  modulo: z.number().int().nullable().optional(),
  turno: z.number().int().nullable().optional(),
  valvula: z.string().nullable().optional(),
  cama: z.string().nullable().optional(),
  es_test_block: z.boolean(),
  codigo_sap_campo: z.string().nullable().optional(),
  es_vigente: z.boolean(),
});
export const FastApiGeografiaPagina = fastApiPagina(FastApiGeografia);

export const Geografia = z.object({
  fundo: z.string().nullable(),
  sector: z.string().nullable(),
  modulo: z.number().int().nullable(),
  turno: z.number().int().nullable(),
  valvula: z.string().nullable(),
  cama: z.string().nullable(),
  esTestBlock: z.boolean(),
  codigoSapCampo: z.string().nullable(),
  esVigente: z.boolean(),
});
export type Geografia = z.infer<typeof Geografia>;

export function mapGeografia(
  r: z.infer<typeof FastApiGeografia>,
): Geografia {
  return {
    fundo: r.fundo ?? null,
    sector: r.sector ?? null,
    modulo: r.modulo ?? null,
    turno: r.turno ?? null,
    valvula: r.valvula ?? null,
    cama: r.cama ?? null,
    esTestBlock: r.es_test_block,
    codigoSapCampo: r.codigo_sap_campo ?? null,
    esVigente: r.es_vigente,
  };
}

/* -------------------------------------------------------------------------- */
/* Personal (Silver.Dim_Personal)                                             */
/* -------------------------------------------------------------------------- */

export const FastApiPersonal = z.object({
  dni: z.string().nullable().optional(),
  nombre_completo: z.string().nullable().optional(),
  rol: z.string().nullable().optional(),
  sexo: z.string().nullable().optional(),
  id_planilla: z.string().nullable().optional(),
  pct_asertividad: z.number().nullable().optional(),
  dias_ausentismo: z.number().int().nullable().optional(),
});
export const FastApiPersonalPagina = fastApiPagina(FastApiPersonal);

export const Personal = z.object({
  dni: z.string().nullable(),
  nombreCompleto: z.string().nullable(),
  rol: z.string().nullable(),
  sexo: z.string().nullable(),
  idPlanilla: z.string().nullable(),
  pctAsertividad: z.number().nullable(),
  diasAusentismo: z.number().int().nullable(),
});
export type Personal = z.infer<typeof Personal>;

export function mapPersonal(r: z.infer<typeof FastApiPersonal>): Personal {
  return {
    dni: r.dni ?? null,
    nombreCompleto: r.nombre_completo ?? null,
    rol: r.rol ?? null,
    sexo: r.sexo ?? null,
    idPlanilla: r.id_planilla ?? null,
    pctAsertividad: r.pct_asertividad ?? null,
    diasAusentismo: r.dias_ausentismo ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers de paginación                                                      */
/* -------------------------------------------------------------------------- */

export function mapPagina<U, T>(
  raw: { total: number; pagina: number; tamano: number; datos: U[] },
  fn: (u: U) => T,
): CatalogoPagina<T> {
  return {
    total: raw.total,
    pagina: raw.pagina,
    tamano: raw.tamano,
    datos: raw.datos.map(fn),
  };
}
