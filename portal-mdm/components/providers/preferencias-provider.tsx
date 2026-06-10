"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

/**
 * Preferencias persistentes del portal (cliente-only).
 *
 * Vive en `localStorage` con prefijo `acp.pref.*`. No requiere backend.
 * Aplica los valores al `<html>` mediante atributos `data-density` y
 * `data-theme` para que el CSS pueda reaccionar:
 *
 *   html[data-density="compacta"] tr { ... }
 *   html[data-theme="oscuro"]     { ... }
 *
 * Implementado con `useSyncExternalStore` — el patrón canónico de React
 * 19 para sincronizar con storage externo. Evita el lint
 * `react-hooks/set-state-in-effect` y el cascading-render del SSR.
 */

export type Densidad = "compacta" | "comoda";
export type Tema = "oscuro" | "sistema";

interface Preferencias {
  densidad: Densidad;
  tema: Tema;
  recordarTabs: boolean;
}

interface Context extends Preferencias {
  setDensidad: (d: Densidad) => void;
  setTema: (t: Tema) => void;
  setRecordarTabs: (r: boolean) => void;
}

const DEFAULTS: Preferencias = {
  densidad: "comoda",
  tema: "oscuro",
  recordarTabs: true,
};

const KEY_DENSIDAD = "acp.pref.densidad";
const KEY_TEMA = "acp.pref.tema";
const KEY_RECORDAR = "acp.pref.recordarTabs";

const STORAGE_EVENT = "acp.pref.changed";

const PreferenciasContext = createContext<Context | null>(null);

function esDensidad(v: string | null): v is Densidad {
  return v === "compacta" || v === "comoda";
}

function esTema(v: string | null): v is Tema {
  return v === "oscuro" || v === "sistema";
}

function leerPrefs(): Preferencias {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const d = window.localStorage.getItem(KEY_DENSIDAD);
    const t = window.localStorage.getItem(KEY_TEMA);
    const r = window.localStorage.getItem(KEY_RECORDAR);
    return {
      densidad: esDensidad(d) ? d : DEFAULTS.densidad,
      tema: esTema(t) ? t : DEFAULTS.tema,
      recordarTabs: r === null ? DEFAULTS.recordarTabs : r === "1",
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Cache estable del snapshot — `useSyncExternalStore` requiere que
 * `getSnapshot` retorne la **misma referencia** cuando los datos no
 * cambian. Si retornáramos `leerPrefs()` directo cada llamada,
 * generaríamos infinitos re-renders.
 */
let cachedSnapshot: Preferencias | null = null;

function getSnapshot(): Preferencias {
  if (cachedSnapshot === null) cachedSnapshot = leerPrefs();
  return cachedSnapshot;
}

function getServerSnapshot(): Preferencias {
  return DEFAULTS;
}

function invalidarSnapshot() {
  cachedSnapshot = null;
}

function notificarCambio() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    invalidarSnapshot();
    onChange();
  };
  // Cambios desde otra pestaña (storage) o desde este mismo provider.
  window.addEventListener("storage", handler);
  window.addEventListener(STORAGE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(STORAGE_EVENT, handler);
  };
}

function aplicarAlHtml(p: Preferencias) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.setAttribute("data-density", p.densidad);
  // El tema "sistema" deja que CSS resuelva con prefers-color-scheme;
  // como nuestros tokens son dark-first lo dejamos sin atributo en ese caso.
  if (p.tema === "sistema") {
    html.removeAttribute("data-theme");
  } else {
    html.setAttribute("data-theme", p.tema);
  }
}

export function PreferenciasProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Sincronizar `<html>` cuando cambien las prefs (en cliente).
  useEffect(() => {
    aplicarAlHtml(prefs);
  }, [prefs]);

  const escribir = useCallback(<K extends keyof Preferencias>(
    k: K,
    v: Preferencias[K],
  ) => {
    if (typeof window === "undefined") return;
    try {
      if (k === "recordarTabs") {
        window.localStorage.setItem(KEY_RECORDAR, v ? "1" : "0");
      } else if (k === "densidad") {
        window.localStorage.setItem(KEY_DENSIDAD, String(v));
      } else if (k === "tema") {
        window.localStorage.setItem(KEY_TEMA, String(v));
      }
    } catch {
      /* localStorage bloqueado / quota — silenciar */
    }
    invalidarSnapshot();
    notificarCambio();
  }, []);

  const value: Context = {
    ...prefs,
    setDensidad: (d) => escribir("densidad", d),
    setTema: (t) => escribir("tema", t),
    setRecordarTabs: (r) => escribir("recordarTabs", r),
  };

  return (
    <PreferenciasContext.Provider value={value}>
      {children}
    </PreferenciasContext.Provider>
  );
}

export function usePreferencias(): Context {
  const ctx = useContext(PreferenciasContext);
  if (!ctx)
    throw new Error("usePreferencias debe usarse dentro de PreferenciasProvider");
  return ctx;
}
