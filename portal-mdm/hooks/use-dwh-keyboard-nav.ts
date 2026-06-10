"use client";

/**
 * hooks/use-dwh-keyboard-nav.ts
 * =============================
 * Atajos de teclado para el DWH Explorer.
 *
 *   ←/→        Salta de capa (Bronce ↔ Silver ↔ Gold). Si no hay selección,
 *              entra en la primera tabla de la capa Bronce.
 *   ↑/↓        Mueve dentro de la capa actual.
 *   Enter/Espacio
 *              Abre / cierra el panel de detalle del nodo enfocado.
 *   Esc        Deselecciona y cierra el panel.
 *   /          Enfoca el input de búsqueda.
 *   ?          Abre / cierra el overlay de ayuda.
 *
 * El handler vive a nivel `window` pero ignora eventos si el target es un
 * `<input>`, `<textarea>` o `[contenteditable]`. Eso evita que al escribir
 * en el filtro las flechas o `/` muevan la selección.
 */

import { useCallback, useEffect, useMemo } from "react";
import type { DwhNode, TableLayer } from "@/lib/schemas/dwh";

const LAYERS: TableLayer[] = ["bronce", "silver", "gold"];

interface UseDwhKeyboardNavParams {
  nodes: DwhNode[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Refs externas que el hook necesita orquestar. */
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  /** Toggle del overlay con la lista de atajos. */
  onToggleHelp: () => void;
  enabled?: boolean;
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

export function useDwhKeyboardNav({
  nodes,
  selectedId,
  onSelect,
  searchInputRef,
  onToggleHelp,
  enabled = true,
}: UseDwhKeyboardNavParams): void {
  // Indexa por capa para resolver vecinos en O(1).
  const byLayer = useMemo(() => {
    const out: Record<TableLayer, DwhNode[]> = { bronce: [], silver: [], gold: [] };
    for (const n of nodes) out[n.layer].push(n);
    return out;
  }, [nodes]);

  const moveLayer = useCallback(
    (delta: -1 | 1) => {
      if (!selectedId) {
        // Sin selección: entra a la primera tabla de Bronce (o la primera capa que tenga algo).
        for (const l of LAYERS) {
          if (byLayer[l].length > 0) {
            onSelect(byLayer[l][0].id);
            return;
          }
        }
        return;
      }
      const current = nodes.find((n) => n.id === selectedId);
      if (!current) return;
      const idx = LAYERS.indexOf(current.layer);
      // Camina hasta la siguiente capa NO vacía en la dirección dada.
      for (let i = idx + delta; i >= 0 && i < LAYERS.length; i += delta) {
        const layer = LAYERS[i];
        const list = byLayer[layer];
        if (list.length === 0) continue;
        // Intenta preservar la "fila" usando el índice del actual en su capa.
        const currentIdx = byLayer[current.layer].findIndex(
          (n) => n.id === current.id,
        );
        const target =
          currentIdx >= 0 && currentIdx < list.length ? list[currentIdx] : list[0];
        onSelect(target.id);
        return;
      }
    },
    [byLayer, nodes, onSelect, selectedId],
  );

  const moveWithin = useCallback(
    (delta: -1 | 1) => {
      if (!selectedId) return;
      const current = nodes.find((n) => n.id === selectedId);
      if (!current) return;
      const list = byLayer[current.layer];
      const idx = list.findIndex((n) => n.id === current.id);
      if (idx === -1) return;
      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= list.length) return;
      onSelect(list[nextIdx].id);
    },
    [byLayer, nodes, onSelect, selectedId],
  );

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      // No interferir con campos editables o con combinaciones del SO.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const editable = isEditableTarget(e.target);

      // `/` enfoca el search incluso si NO estás en él. Pero si ya estás escribiendo, dejarlo pasar.
      if (e.key === "/" && !editable) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === "?" && !editable) {
        e.preventDefault();
        onToggleHelp();
        return;
      }

      // Esc funciona incluso desde el input — además limpia foco.
      if (e.key === "Escape") {
        if (editable) {
          (e.target as HTMLElement).blur();
          return;
        }
        if (selectedId) {
          e.preventDefault();
          onSelect(null);
        }
        return;
      }

      // El resto sólo si NO estamos editando.
      if (editable) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          moveLayer(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveLayer(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveWithin(-1);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveWithin(1);
          break;
        case "Enter":
        case " ":
          // Si nada seleccionado y Enter, no hacemos nada — preserva submit en formularios.
          if (selectedId) {
            e.preventDefault();
            onSelect(null); // toggle: cierra panel si ya estaba abierto.
          }
          break;
        default:
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, moveLayer, moveWithin, onSelect, onToggleHelp, searchInputRef, selectedId]);
}
