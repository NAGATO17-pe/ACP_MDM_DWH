"use client";

/**
 * hooks/use-pinned-nodes.ts
 * =========================
 * Persistencia de nodos "fijados" del DWH Explorer.
 *
 * El operador típicamente vigila 3-5 facts (los que más se rompen en su
 * dominio). Pinearlos los rodea con un ring permanente y sobrevive refresh.
 *
 * Implementación: `useSyncExternalStore` apuntando a localStorage —
 * evita warnings de "setState synchronously in effect" y mantiene
 * coherencia entre pestañas (escucha `storage` events).
 */

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "acp.dwh.pinned-nodes.v1";
const MAX_PINS = 12;

const EMPTY_SET: ReadonlySet<string> = new Set();

/* ── External store cacheado ───────────────────────────────────────────── */
//
// `useSyncExternalStore` exige que `getSnapshot` retorne SIEMPRE la misma
// referencia si los datos no cambiaron — de lo contrario React entra en
// un loop "infinite update detected". Cacheamos por contenido.

let cachedJson: string | null | undefined = undefined;
let cachedSet: ReadonlySet<string> = EMPTY_SET;

function getSnapshot(): ReadonlySet<string> {
  if (typeof window === "undefined") return EMPTY_SET;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedJson) return cachedSet;
  cachedJson = raw;
  cachedSet = parseSet(raw);
  return cachedSet;
}

function getServerSnapshot(): ReadonlySet<string> {
  return EMPTY_SET;
}

function parseSet(raw: string | null): ReadonlySet<string> {
  if (!raw) return EMPTY_SET;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_SET;
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return EMPTY_SET;
  }
}

function subscribe(notify: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) notify();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LOCAL_EVENT, notify);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCAL_EVENT, notify);
  };
}

// `storage` event solo dispara entre pestañas distintas — para que la misma
// pestaña re-renderice cuando hacemos `toggle`, despachamos un evento custom.
const LOCAL_EVENT = "acp:dwh-pinned-changed";

function writeAndNotify(next: ReadonlySet<string>): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(Array.from(next));
    window.localStorage.setItem(STORAGE_KEY, json);
    // Actualizamos caché manualmente para que el próximo getSnapshot
    // retorne la nueva ref sin esperar al ciclo de eventos.
    cachedJson = json;
    cachedSet = next;
    window.dispatchEvent(new Event(LOCAL_EVENT));
  } catch {
    /* quota / privacy mode — pin sólo en memoria */
  }
}

/* ── Hook público ──────────────────────────────────────────────────────── */

export interface UsePinnedNodesResult {
  pinned: ReadonlySet<string>;
  isPinned: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
  /** Cuántos slots quedan antes del límite. Útil para UI. */
  remaining: number;
}

export function usePinnedNodes(): UsePinnedNodesResult {
  const pinned = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((id: string) => {
    const current = getSnapshot();
    const next = new Set(current);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= MAX_PINS) {
        const oldest = next.values().next().value;
        if (oldest) next.delete(oldest);
      }
      next.add(id);
    }
    writeAndNotify(next);
  }, []);

  const clear = useCallback(() => {
    writeAndNotify(EMPTY_SET);
  }, []);

  const isPinned = useCallback((id: string) => pinned.has(id), [pinned]);

  return {
    pinned,
    isPinned,
    toggle,
    clear,
    remaining: Math.max(0, MAX_PINS - pinned.size),
  };
}
