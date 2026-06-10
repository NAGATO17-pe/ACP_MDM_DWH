"use client";

/**
 * hooks/use-saved-views.ts
 * ========================
 * CRUD de vistas guardadas del DWH Explorer.
 *
 * Una "vista" es un `DwhUrlSnapshot` etiquetado con un nombre.
 * Persistido en localStorage; sincronizado entre pestañas igual que
 * `usePinnedNodes` — vía `useSyncExternalStore` con un evento custom.
 *
 * Límite de 10 vistas por usuario (cabe en la dropdown sin scroll
 * en monitores típicos y evita inflar localStorage).
 */

import { useCallback, useSyncExternalStore } from "react";
import type { DwhUrlSnapshot } from "@/app/(admin)/dwh/use-dwh-url-state";

const STORAGE_KEY = "acp.dwh.saved-views.v1";
const LOCAL_EVENT = "acp:dwh-views-changed";
const MAX_VIEWS = 10;

export interface SavedView {
  id: string;
  name: string;
  createdAt: number;
  snapshot: DwhUrlSnapshot;
}

const EMPTY_LIST: readonly SavedView[] = Object.freeze([]);

let cachedJson: string | null | undefined = undefined;
let cachedList: readonly SavedView[] = EMPTY_LIST;

function parseList(raw: string | null): readonly SavedView[] {
  if (!raw) return EMPTY_LIST;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_LIST;
    // Validación defensiva — descartamos entradas malformadas en vez
    // de hacer Zod aquí (overkill para localStorage).
    const out: SavedView[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.createdAt === "number" &&
        item.snapshot &&
        typeof item.snapshot === "object"
      ) {
        out.push(item as SavedView);
      }
    }
    return Object.freeze(out);
  } catch {
    return EMPTY_LIST;
  }
}

function getSnapshot(): readonly SavedView[] {
  if (typeof window === "undefined") return EMPTY_LIST;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedJson) return cachedList;
  cachedJson = raw;
  cachedList = parseList(raw);
  return cachedList;
}

function getServerSnapshot(): readonly SavedView[] {
  return EMPTY_LIST;
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

function writeAndNotify(next: readonly SavedView[]): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(next);
    window.localStorage.setItem(STORAGE_KEY, json);
    cachedJson = json;
    cachedList = next;
    window.dispatchEvent(new Event(LOCAL_EVENT));
  } catch {
    /* quota */
  }
}

export interface UseSavedViewsResult {
  views: readonly SavedView[];
  save: (name: string, snapshot: DwhUrlSnapshot) => SavedView | null;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  /** Slots restantes. */
  remaining: number;
}

export function useSavedViews(): UseSavedViewsResult {
  const views = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const save = useCallback(
    (rawName: string, snapshot: DwhUrlSnapshot): SavedView | null => {
      const name = rawName.trim().slice(0, 60);
      if (!name) return null;
      const current = getSnapshot();
      if (current.length >= MAX_VIEWS) return null;
      const view: SavedView = {
        id: `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        createdAt: Date.now(),
        snapshot,
      };
      writeAndNotify(Object.freeze([view, ...current]));
      return view;
    },
    [],
  );

  const rename = useCallback((id: string, rawName: string) => {
    const name = rawName.trim().slice(0, 60);
    if (!name) return;
    const current = getSnapshot();
    const next = current.map((v) => (v.id === id ? { ...v, name } : v));
    writeAndNotify(Object.freeze(next));
  }, []);

  const remove = useCallback((id: string) => {
    const current = getSnapshot();
    writeAndNotify(Object.freeze(current.filter((v) => v.id !== id)));
  }, []);

  return {
    views,
    save,
    rename,
    remove,
    remaining: Math.max(0, MAX_VIEWS - views.length),
  };
}
