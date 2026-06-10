"use client";

/**
 * hooks/use-status-flash.ts
 * =========================
 * Detecta transiciones de status en el snapshot de nodos del DWH y devuelve
 * el set de nodos cuyo status empeoró en el último refetch — útil para
 * disparar un pulso visual no intrusivo (#16 del backlog DWH).
 *
 * Reglas:
 *   - Sólo "flash" cuando el estado va a peor (ok → warning/failed/stale).
 *   - El flash dura `FLASH_MS`; tras ese plazo el nodo sale del set.
 *   - El primer snapshot tras montar no flashea nada (seedea el baseline).
 *
 * Notas de implementación:
 *   - Los `setState` se hacen mediante `setTimeout(..., 0)` para evitar
 *     llamadas síncronas dentro del cuerpo del effect (regla del linter
 *     `react-hooks/set-state-in-effect`). Eso desacopla la actualización
 *     del render que disparó el cambio en `nodes`.
 */

import { useEffect, useReducer, useRef } from "react";
import type { DwhNode, TableStatus } from "@/lib/schemas/dwh";

const FLASH_MS = 2200;
const SEVERITY: Record<TableStatus, number> = {
  ok: 0,
  unknown: 1,
  stale: 2,
  warning: 3,
  failed: 4,
};

type Action =
  | { type: "add"; ids: string[] }
  | { type: "remove"; id: string };

function reducer(state: Set<string>, action: Action): Set<string> {
  switch (action.type) {
    case "add": {
      const next = new Set(state);
      for (const id of action.ids) next.add(id);
      return next;
    }
    case "remove": {
      if (!state.has(action.id)) return state;
      const next = new Set(state);
      next.delete(action.id);
      return next;
    }
    default:
      return state;
  }
}

export function useStatusFlash(nodes: DwhNode[] | undefined): Set<string> {
  const [flashing, dispatch] = useReducer(reducer, undefined, () => new Set<string>());
  const prevRef = useRef<Map<string, TableStatus> | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!nodes) return;
    const current = new Map<string, TableStatus>(nodes.map((n) => [n.id, n.status]));

    // Primera ejecución: sólo seedea la referencia. No flasheamos al montar.
    if (prevRef.current == null) {
      prevRef.current = current;
      return;
    }

    const toFlash: string[] = [];
    for (const [id, status] of current) {
      const prev = prevRef.current.get(id);
      if (prev != null && SEVERITY[status] > SEVERITY[prev]) {
        toFlash.push(id);
      }
    }

    if (toFlash.length > 0) {
      // Dispatch asíncrono — desacoplado del cuerpo del effect.
      const startTimer = setTimeout(() => {
        dispatch({ type: "add", ids: toFlash });
      }, 0);

      const removalTimers = toFlash.map((id) => {
        const existing = timersRef.current.get(id);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          dispatch({ type: "remove", id });
          timersRef.current.delete(id);
        }, FLASH_MS);
        timersRef.current.set(id, t);
        return t;
      });

      // Cleanup parcial: el cleanup del effect no debe cancelar los timers
      // que ya entregaron el flash visual del refetch anterior — sólo el
      // `startTimer` que aún no disparó.
      void removalTimers;
      const cleanup = () => clearTimeout(startTimer);
      prevRef.current = current;
      return cleanup;
    }

    prevRef.current = current;
  }, [nodes]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  return flashing;
}
