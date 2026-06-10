"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * Persiste `q` (búsqueda), `sort` y `page` de una tabla en el query string
 * de la URL. Se comparte estado entre pestañas y permite copy-paste del
 * link con el mismo filtro. Sin librerías externas — solo App Router.
 *
 * El prefijo evita colisiones cuando hay dos tablas en la misma ruta:
 *
 *   const a = useTableQueryState({ prefix: "alerts" });
 *   const b = useTableQueryState({ prefix: "rejects" });
 */
export interface TableQueryState {
  q: string;
  setQ: (value: string) => void;
  page: number;
  setPage: (value: number) => void;
  sort: string | null;
  setSort: (value: string | null) => void;
  reset: () => void;
}

interface Options {
  prefix?: string;
  defaultPage?: number;
}

export function useTableQueryState({
  prefix = "",
  defaultPage = 1,
}: Options = {}): TableQueryState {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const key = useCallback(
    (k: string) => (prefix ? `${prefix}_${k}` : k),
    [prefix],
  );

  const q = search.get(key("q")) ?? "";
  const pageParam = search.get(key("page"));
  const page = pageParam ? Math.max(defaultPage, parseInt(pageParam, 10) || defaultPage) : defaultPage;
  const sort = search.get(key("sort"));

  const replace = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, search],
  );

  const setQ = useCallback(
    (value: string) => {
      // Cualquier cambio en `q` resetea page a 1.
      replace({ [key("q")]: value || null, [key("page")]: null });
    },
    [replace, key],
  );

  const setPage = useCallback(
    (value: number) => {
      replace({ [key("page")]: value === defaultPage ? null : String(value) });
    },
    [replace, key, defaultPage],
  );

  const setSort = useCallback(
    (value: string | null) => {
      replace({ [key("sort")]: value });
    },
    [replace, key],
  );

  const reset = useCallback(() => {
    replace({
      [key("q")]: null,
      [key("page")]: null,
      [key("sort")]: null,
    });
  }, [replace, key]);

  return useMemo(
    () => ({ q, setQ, page, setPage, sort, setSort, reset }),
    [q, page, sort, setQ, setPage, setSort, reset],
  );
}
