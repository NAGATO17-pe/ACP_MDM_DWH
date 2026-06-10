"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { z } from "zod";
import {
  CrearUsuarioInput,
  FastApiMensaje,
  ParametrosPagina,
  Perfil,
  ReglasPagina,
  Usuario,
} from "@/lib/schemas/configuracion";

/**
 * Hooks de Configuración.
 *
 * Lectura: perfil, parámetros, reglas, usuarios.
 * Escritura: cambiar-clave, actualizar parámetro, crear/activar/desactivar usuario.
 *
 * Cada mutación invalida solo lo necesario para mantener consistencia.
 */

const KEY_PERFIL = ["cc", "configuracion", "perfil"] as const;
const KEY_PARAMS = ["cc", "configuracion", "parametros"] as const;
const KEY_REGLAS = ["cc", "configuracion", "reglas"] as const;
const KEY_USERS = ["cc", "configuracion", "usuarios"] as const;

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

/* -------------------------------------------------------------------------- */
/* Perfil                                                                     */
/* -------------------------------------------------------------------------- */

export function useProfile(): UseQueryResult<Perfil> {
  return useQuery({
    queryKey: KEY_PERFIL,
    queryFn: () => fetchJson(`/api/cc/configuracion/perfil`, Perfil),
    staleTime: 5 * 60_000,
  });
}

export interface ChangePasswordInput {
  claveActual: string;
  claveNueva: string;
}

export function useChangePassword(): UseMutationResult<
  z.infer<typeof FastApiMensaje>,
  Error,
  ChangePasswordInput
> {
  return useMutation({
    mutationFn: (input) =>
      fetchJson(`/api/cc/configuracion/perfil/clave`, FastApiMensaje, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
  });
}

/* -------------------------------------------------------------------------- */
/* Parámetros                                                                 */
/* -------------------------------------------------------------------------- */

export function useParametros(params?: {
  pagina?: number;
  tamano?: number;
}): UseQueryResult<ParametrosPagina> {
  const pagina = params?.pagina ?? 1;
  const tamano = params?.tamano ?? 100;
  return useQuery({
    queryKey: [...KEY_PARAMS, pagina, tamano],
    queryFn: () =>
      fetchJson(
        `/api/cc/configuracion/parametros?pagina=${pagina}&tamano=${tamano}`,
        ParametrosPagina,
      ),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}

export interface ActualizarParametroVars {
  nombre: string;
  valor: string;
}

export function useUpdateParametro(): UseMutationResult<
  z.infer<typeof FastApiMensaje>,
  Error,
  ActualizarParametroVars
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nombre, valor }) =>
      fetchJson(
        `/api/cc/configuracion/parametros/${encodeURIComponent(nombre)}`,
        FastApiMensaje,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ valor }),
        },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_PARAMS }),
  });
}

/* -------------------------------------------------------------------------- */
/* Reglas                                                                     */
/* -------------------------------------------------------------------------- */

export function useReglas(params?: {
  pagina?: number;
  tamano?: number;
}): UseQueryResult<ReglasPagina> {
  const pagina = params?.pagina ?? 1;
  const tamano = params?.tamano ?? 200;
  return useQuery({
    queryKey: [...KEY_REGLAS, pagina, tamano],
    queryFn: () =>
      fetchJson(
        `/api/cc/configuracion/reglas?pagina=${pagina}&tamano=${tamano}`,
        ReglasPagina,
      ),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60_000,
  });
}

/* -------------------------------------------------------------------------- */
/* Usuarios                                                                   */
/* -------------------------------------------------------------------------- */

export function useUsuarios(opts: { enabled: boolean }): UseQueryResult<
  Usuario[]
> {
  return useQuery({
    queryKey: KEY_USERS,
    queryFn: () =>
      fetchJson(`/api/cc/configuracion/usuarios`, z.array(Usuario)),
    enabled: opts.enabled,
    staleTime: 60_000,
  });
}

export function useCreateUser(): UseMutationResult<
  Usuario,
  Error,
  CrearUsuarioInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      fetchJson(`/api/cc/configuracion/usuarios`, Usuario, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_USERS }),
  });
}

interface ToggleUserVars {
  nombre: string;
  activar: boolean;
}

export function useToggleUser(): UseMutationResult<
  z.infer<typeof FastApiMensaje>,
  Error,
  ToggleUserVars
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nombre, activar }) =>
      fetchJson(
        `/api/cc/configuracion/usuarios/${encodeURIComponent(nombre)}/${activar ? "activar" : "desactivar"}`,
        FastApiMensaje,
        { method: "POST" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_USERS }),
  });
}
