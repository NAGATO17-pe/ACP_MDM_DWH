"use client";

/**
 * components/control-center/dwh-node-context-menu.tsx
 * ===================================================
 * Menú contextual (botón derecho) sobre un nodo del DWH.
 *
 * Implementación propia liviana — sin radix-context-menu — porque el grafo
 * vive en SVG y el delegate sobre `[data-dwh-node]` es más simple así.
 *
 * El padre (lineage graph o cliente) decide qué nodo abre el menú y dónde,
 * y este componente sólo:
 *   - Se posiciona en `x,y` ajustando para no salir del viewport.
 *   - Cierra al hacer click fuera, Esc o scroll.
 *   - Inyecta los items que recibe — totalmente desacoplado de las acciones.
 */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface NodeMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

interface DwhNodeContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  /** Nombre del nodo, mostrado como encabezado opcional. */
  heading?: string;
  items: NodeMenuItem[];
  onClose: () => void;
}

export function DwhNodeContextMenu({
  open,
  x,
  y,
  heading,
  items,
  onClose,
}: DwhNodeContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Posicionamiento defensivo: si el menú se sale del viewport, lo movemos.
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x;
    let ny = y;
    if (rect.right > vw - 8) nx = Math.max(8, x - rect.width);
    if (rect.bottom > vh - 8) ny = Math.max(8, y - rect.height);
    el.style.left = `${nx}px`;
    el.style.top = `${ny}px`;
  }, [open, x, y, items.length]);

  // Cerrar al click fuera / scroll / Esc.
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = () => onClose();
    // Pequeño delay para evitar que el mousedown que abrió el menú lo cierre.
    const t = setTimeout(() => {
      window.addEventListener("mousedown", onMouse);
      window.addEventListener("keydown", onKey);
      window.addEventListener("scroll", onScroll, true);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", onMouse);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      aria-orientation="vertical"
      className={cn(
        "fixed z-[60] min-w-[200px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-xl",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
      )}
      data-state="open"
      style={{ left: x, top: y }}
    >
      {heading ? (
        <div className="truncate border-b border-[var(--color-border)] px-2 py-1 font-mono text-[10px] text-[var(--color-text-muted)]">
          {heading}
        </div>
      ) : null}
      <ul>
        {items.map((it, idx) => (
          <li key={`${it.id}-${idx}`}>
            {it.id === "_separator" ? (
              <hr className="my-1 border-t border-[var(--color-border)]" />
            ) : (
              <button
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  if (it.disabled) return;
                  it.onSelect();
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                  it.disabled
                    ? "cursor-not-allowed text-[var(--color-text-muted)] opacity-60"
                    : it.danger
                      ? "text-[var(--color-destructive)] hover:bg-[color-mix(in_oklab,var(--color-destructive)_10%,transparent)]"
                      : "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
                )}
              >
                {it.icon ? (
                  <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center">
                    {it.icon}
                  </span>
                ) : (
                  <span aria-hidden className="inline-block h-4 w-4" />
                )}
                <span className="flex-1">{it.label}</span>
                {it.shortcut ? (
                  <kbd className="font-mono text-[10px] text-[var(--color-text-muted)]">
                    {it.shortcut}
                  </kbd>
                ) : null}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
