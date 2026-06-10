"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  CrearVariedadInput,
  FastApiOperacionVariedad,
  type CatalogoPagina,
  type Geografia,
  type Personal,
  type VariedadDim,
  type VariedadMdm,
} from "@/lib/schemas/catalogos";
import { z } from "zod";

/**
 * Hooks de Catálogos (MDM + Silver DWH).
 *
 * - 4 listados de solo lectura con paginación server-side.
 * - 3 mutaciones admin sobre Silver.Dim_Variedad: crear / desactivar / reactivar.
 * - Las mutaciones invalidan el listado de Dim_Variedad para mantenerlo fresco.
 */

const KEY_VAR_MDM = ["cc", "catalogos", "variedades-mdm"] as const;
const KEY_VAR_DIM = ["cc", "catalogos", "variedades-dim"] as const;
const KEY_GEO = ["cc", "catalogos", "geografia"] as const;
const KEY_PER = ["cc", "catalogos", "personal"] as const;

/* -------------------------------------------------------------------------- */

interface PaginaParams {
  pagina: number;
  tamano: number;
}

// Schemas runtime (zod) para parse de respuestas internas /api/cc/*
const VariedadMdmShape = z.object({
  nombreCanonico: z.string(),
  breeder: z.string().nullable(),
  esActiva: z.boolean(),
});
const VariedadDimShape = z.object({
  idVariedad: z.number().int(),
  nombreVariedad: z.string(),
  breeder: z.string().nullable(),
  esActiva: z.boolean(),
  fechaCreacion: z.string().nullable(),
  fechaModificacion: z.string().nullable(),
});
const GeografiaShape = z.object({
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
const PersonalShape = z.object({
  dni: z.string().nullable(),
  nombreCompleto: z.string().nullable(),
  rol: z.string().nullable(),
  sexo: z.string().nullable(),
  idPlanilla: z.string().nullable(),
  pctAsertividad: z.number().nullable(),
  diasAusentismo: z.number().int().nullable(),
});

const paginaShape = <T extends z.ZodTypeAny>(fila: T) =>
  z.object({
    total: z.number().int().nonnegative(),
    pagina: z.number().int().positive(),
    tamano: z.number().int().positive(),
    datos: z.array(fila),
  });

async function fetchJson<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body === "object" && "detail" in body) {
        detail = String((body as { detail: unknown }).detail);
      }
    } catch {
      /* ignore */
    }
    const err = new Error(`${path} → ${res.status}: ${detail}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return schema.parse(await res.json());
}

function querystring({ pagina, tamano }: PaginaParams): string {
  return `pagina=${pagina}&tamano=${tamano}`;
}

/* -------------------------------------------------------------------------- */
/* Listados                                                                   */
/* -------------------------------------------------------------------------- */

export function useVariedadesMdm(
  params: PaginaParams,
): UseQueryResult<CatalogoPagina<VariedadMdm>> {
  return useQuery({
    queryKey: [...KEY_VAR_MDM, params.pagina, params.tamano],
    queryFn: () =>
      fetchJson(
        `/api/cc/catalogos/variedades?${querystring(params)}`,
        paginaShape(VariedadMdmShape),
      ),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60_000,
  });
}

export function useVariedadesDim(
  params: PaginaParams,
): UseQueryResult<CatalogoPagina<VariedadDim>> {
  return useQuery({
    queryKey: [...KEY_VAR_DIM, params.pagina, params.tamano],
    queryFn: () =>
      fetchJson(
        `/api/cc/catalogos/variedades-dim?${querystring(params)}`,
        paginaShape(VariedadDimShape),
      ),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60_000,
  });
}

export function useGeografia(
  params: PaginaParams,
): UseQueryResult<CatalogoPagina<Geografia>> {
  return useQuery({
    queryKey: [...KEY_GEO, params.pagina, params.tamano],
    queryFn: () =>
      fetchJson(
        `/api/cc/catalogos/geografia?${querystring(params)}`,
        paginaShape(GeografiaShape),
      ),
    placeholderData: (prev) => prev,
    staleTime: 10 * 60_000,
  });
}

export function usePersonal(
  params: PaginaParams,
): UseQueryResult<CatalogoPagina<Personal>> {
  return useQuery({
    queryKey: [...KEY_PER, params.pagina, params.tamano],
    queryFn: () =>
      fetchJson(
        `/api/cc/catalogos/personal?${querystring(params)}`,
        paginaShape(PersonalShape),
      ),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60_000,
  });
}

/* -------------------------------------------------------------------------- */
/* Mutaciones admin sobre Silver.Dim_Variedad                                 */
/* -------------------------------------------------------------------------- */

export function useCrearVariedad(): UseMutationResult<
  z.infer<typeof FastApiOperacionVariedad>,
  Error,
  CrearVariedadInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      fetchJson(
        `/api/cc/catalogos/variedades-dim`,
        FastApiOperacionVariedad,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_VAR_DIM });
      qc.invalidateQueries({ queryKey: KEY_VAR_MDM });
    },
  });
}

interface CambioEstadoInput {
  idVariedad: number;
}

export function useDesactivarVariedad(): UseMutationResult<
  z.infer<typeof FastApiOperacionVariedad>,
  Error,
  CambioEstadoInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ idVariedad }) =>
      fetchJson(
        `/api/cc/catalogos/variedades-dim/${idVariedad}/desactivar`,
        FastApiOperacionVariedad,
        { method: "PATCH" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_VAR_DIM }),
  });
}

export function useReactivarVariedad(): UseMutationResult<
  z.infer<typeof FastApiOperacionVariedad>,
  Error,
  CambioEstadoInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ idVariedad }) =>
      fetchJson(
        `/api/cc/catalogos/variedades-dim/${idVariedad}/reactivar`,
        FastApiOperacionVariedad,
        { method: "PATCH" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_VAR_DIM }),
  });
}
