"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ParamValue = string | number | null;
// Setter allows null for any key to signal "remove this param from URL".
type UrlUpdates<T extends Record<string, ParamValue>> = {
  [K in keyof T]?: T[K] | null;
};

/**
 * Sincroniza un Record de valores con los search-params de la URL.
 * - Leer: devuelve los params actuales, casteados al tipo del default.
 * - Escribir: reemplaza la URL sin scroll. Si el valor es igual al default
 *   o null, elimina el param para mantener URLs limpias.
 * - `set` es estable (no cambia de referencia) — no necesita ir en deps de useEffect.
 */
export function useUrlState<T extends Record<string, ParamValue>>(
  defaults: T,
): [T, (updates: UrlUpdates<T>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Keep latest router/params in a ref so the stable `set` always uses current values.
  // Written in a useEffect to avoid the "mutating ref during render" React 19 restriction.
  const latestRef = useRef({ router, pathname, searchParams, defaults });
  useEffect(() => {
    latestRef.current = { router, pathname, searchParams, defaults };
  });

  // Derive state from searchParams — read `defaults` directly (not via ref) so
  // the linter does not flag a ref read during render.
  const state = Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => {
      const raw = searchParams.get(key);
      if (raw === null) return [key, defaultValue];
      if (typeof defaultValue === "number") {
        const n = Number(raw);
        return [key, Number.isNaN(n) ? defaultValue : n];
      }
      return [key, raw];
    }),
  ) as T;

  // Stable set — empty deps; reads latest values via latestRef at call time.
  // Safe to omit from useEffect dependency arrays.
  const set = useCallback((updates: UrlUpdates<T>) => {
    const { router, pathname, searchParams, defaults } = latestRef.current;
    const sp = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === (defaults as Record<string, ParamValue>)[key]) {
        sp.delete(key);
      } else {
        sp.set(key, String(value));
      }
    }
    const qs = sp.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, []);

  return [state, set];
}
