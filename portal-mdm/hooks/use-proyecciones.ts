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
  Combinacion,
  EjecutarProyeccionInput,
  FechasDisponibles,
  MatrizInputs,
  RespuestaProyeccion,
} from "@/lib/schemas/proyecciones";

async function fetchParse<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
  return schema.parse(await res.json());
}

export function useFechasProyeccion(): UseQueryResult<FechasDisponibles> {
  return useQuery({
    queryKey: ["proyecciones", "fechas"],
    queryFn: () => fetchParse("/api/cc/proyecciones/fechas", FechasDisponibles),
    staleTime: 10 * 60_000,
  });
}

export function useCombinaciones(idTiempo: number | null): UseQueryResult<Combinacion[]> {
  return useQuery({
    queryKey: ["proyecciones", "combinaciones", idTiempo],
    queryFn: () =>
      fetchParse(`/api/cc/proyecciones/combinaciones/${idTiempo}`, z.array(Combinacion)),
    enabled: idTiempo != null,
    staleTime: 5 * 60_000,
  });
}

export function useMatrizGuardada(): UseQueryResult<MatrizInputs> {
  return useQuery({
    queryKey: ["proyecciones", "matriz"],
    queryFn: () => fetchParse("/api/cc/proyecciones/matriz", MatrizInputs),
    staleTime: 5 * 60_000,
  });
}

export function useGuardarMatriz(): UseMutationResult<unknown, Error, MatrizInputs> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matriz) =>
      fetchParse("/api/cc/proyecciones/matriz", z.unknown(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(matriz),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["proyecciones", "matriz"] }),
  });
}

export function useEjecutarProyeccion(): UseMutationResult<
  RespuestaProyeccion,
  Error,
  EjecutarProyeccionInput
> {
  return useMutation({
    mutationFn: (input) =>
      fetchParse("/api/cc/proyecciones/ejecutar", RespuestaProyeccion, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
  });
}
