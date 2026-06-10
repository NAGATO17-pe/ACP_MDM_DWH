"use client";

/**
 * Estado en URL del DWH Explorer.
 *
 * Persiste `view`, `q`, `status` (multi), `node` (selección actual) y
 * `density`. Compartible vía link, sobrevive refresh y permite que el
 * back button "deshaga" filtros como se espera.
 *
 * No usa libs externas — sólo App Router.
 */

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TableStatus } from "@/lib/schemas/dwh";

export type DwhView = "lineage" | "table";
export type DwhDensity = "comfortable" | "compact";
export type DwhLayer = "bronce" | "silver" | "gold";

const ALL_STATUSES: TableStatus[] = [
  "ok",
  "warning",
  "failed",
  "stale",
  "unknown",
];

const ALL_LAYERS: DwhLayer[] = ["bronce", "silver", "gold"];

export interface DwhUrlState {
  view: DwhView;
  setView: (v: DwhView) => void;
  q: string;
  setQ: (v: string) => void;
  statuses: Set<TableStatus>;
  toggleStatus: (s: TableStatus) => void;
  clearStatuses: () => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  /** Segundo nodo en modo compare. */
  compareId: string | null;
  setCompareId: (id: string | null) => void;
  density: DwhDensity;
  setDensity: (d: DwhDensity) => void;
  /** Capas colapsadas a barra delgada. */
  collapsed: Set<DwhLayer>;
  toggleCollapsedLayer: (l: DwhLayer) => void;
  /** Aplica un snapshot completo de filtros (saved view restore). */
  applySnapshot: (snap: DwhUrlSnapshot) => void;
  /** Captura el estado actual para guardar como vista. */
  takeSnapshot: () => DwhUrlSnapshot;
  /** Hay algún filtro/selección activo. */
  hasFilters: boolean;
  resetAll: () => void;
}

export interface DwhUrlSnapshot {
  view: DwhView;
  q: string;
  density: DwhDensity;
  statuses: TableStatus[];
  collapsed: DwhLayer[];
  selectedId: string | null;
}

export function useDwhUrlState(): DwhUrlState {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const view: DwhView =
    search.get("view") === "table" ? "table" : "lineage";
  const q = search.get("q") ?? "";
  const selectedId = search.get("node");
  const compareId = search.get("cmp");
  const density: DwhDensity =
    search.get("density") === "compact" ? "compact" : "comfortable";

  const collapsed = useMemo<Set<DwhLayer>>(() => {
    const raw = search.get("collapsed");
    if (!raw) return new Set();
    const wanted = raw.split(",").filter((s): s is DwhLayer =>
      (ALL_LAYERS as string[]).includes(s),
    );
    return new Set(wanted);
  }, [search]);

  const statuses = useMemo<Set<TableStatus>>(() => {
    const raw = search.get("status");
    if (!raw) return new Set(ALL_STATUSES);
    const wanted = raw.split(",").filter((s): s is TableStatus =>
      (ALL_STATUSES as string[]).includes(s),
    );
    return wanted.length ? new Set(wanted) : new Set(ALL_STATUSES);
  }, [search]);

  const replace = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
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

  const setView = useCallback(
    (v: DwhView) => replace({ view: v === "lineage" ? null : "table" }),
    [replace],
  );
  const setQ = useCallback((v: string) => replace({ q: v || null }), [replace]);
  const setSelectedId = useCallback(
    (id: string | null) => replace({ node: id || null }),
    [replace],
  );
  const setCompareId = useCallback(
    (id: string | null) => replace({ cmp: id || null }),
    [replace],
  );
  const setDensity = useCallback(
    (d: DwhDensity) => replace({ density: d === "compact" ? "compact" : null }),
    [replace],
  );

  const toggleCollapsedLayer = useCallback(
    (l: DwhLayer) => {
      const next = new Set(collapsed);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      // No permitir colapsar las 3 capas — quedaría sin nada visible.
      if (next.size === ALL_LAYERS.length) next.delete(l);
      replace({ collapsed: next.size === 0 ? null : Array.from(next).join(",") });
    },
    [collapsed, replace],
  );

  const toggleStatus = useCallback(
    (s: TableStatus) => {
      const isAll = statuses.size === ALL_STATUSES.length;
      const current = isAll ? new Set([s]) : new Set(statuses);
      if (!isAll) {
        if (current.has(s)) current.delete(s);
        else current.add(s);
      } else {
        // si estaban todos activos y haces click en uno, te quedas con ese solo.
      }
      if (current.size === 0 || current.size === ALL_STATUSES.length) {
        replace({ status: null });
      } else {
        replace({ status: Array.from(current).join(",") });
      }
    },
    [statuses, replace],
  );

  const clearStatuses = useCallback(() => replace({ status: null }), [replace]);

  const hasFilters =
    q.trim().length > 0 ||
    statuses.size !== ALL_STATUSES.length ||
    selectedId != null ||
    compareId != null ||
    collapsed.size > 0;

  const resetAll = useCallback(() => {
    replace({
      q: null,
      status: null,
      node: null,
      cmp: null,
      collapsed: null,
    });
  }, [replace]);

  const takeSnapshot = useCallback<DwhUrlState["takeSnapshot"]>(
    () => ({
      view,
      q,
      density,
      statuses: Array.from(statuses),
      collapsed: Array.from(collapsed),
      selectedId,
    }),
    [view, q, density, statuses, collapsed, selectedId],
  );

  const applySnapshot = useCallback<DwhUrlState["applySnapshot"]>(
    (snap) => {
      replace({
        view: snap.view === "lineage" ? null : snap.view,
        q: snap.q || null,
        density: snap.density === "compact" ? "compact" : null,
        status:
          snap.statuses.length === 0 ||
          snap.statuses.length === ALL_STATUSES.length
            ? null
            : snap.statuses.join(","),
        collapsed: snap.collapsed.length === 0 ? null : snap.collapsed.join(","),
        node: snap.selectedId || null,
        cmp: null,
      });
    },
    [replace],
  );

  return {
    view,
    setView,
    q,
    setQ,
    statuses,
    toggleStatus,
    clearStatuses,
    selectedId,
    setSelectedId,
    compareId,
    setCompareId,
    density,
    setDensity,
    collapsed,
    toggleCollapsedLayer,
    applySnapshot,
    takeSnapshot,
    hasFilters,
    resetAll,
  };
}

export const DWH_ALL_STATUSES = ALL_STATUSES;
