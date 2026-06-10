"use client";

/**
 * components/control-center/dwh-keyboard-help.tsx
 * ===============================================
 * Overlay flotante con los atajos de teclado del DWH Explorer.
 * Toggle con `?` desde el hook `useDwhKeyboardNav`.
 *
 * Usa el Dialog de Radix para tener focus-trap, ESC, y backdrop
 * accesible sin reimplementar nada.
 */

import * as Dialog from "@radix-ui/react-dialog";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DwhKeyboardHelpProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["←", "→"], label: "Cambiar de capa (Bronce ↔ Silver ↔ Gold)" },
  { keys: ["↑", "↓"], label: "Moverse dentro de la capa actual" },
  { keys: ["Enter"], label: "Abrir / cerrar el panel del nodo enfocado" },
  { keys: ["Esc"], label: "Cerrar el panel y deseleccionar" },
  { keys: ["/"], label: "Enfocar el cuadro de búsqueda" },
  { keys: ["?"], label: "Mostrar / ocultar esta ayuda" },
];

export function DwhKeyboardHelp({ open, onOpenChange }: DwhKeyboardHelpProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=closed]:fade-out-0",
          )}
        >
          <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <Keyboard
                aria-hidden
                className="h-4 w-4 text-[var(--color-text-muted)]"
              />
              <Dialog.Title className="text-sm font-semibold text-[var(--color-text)]">
                Atajos de teclado
              </Dialog.Title>
            </div>
            <Dialog.Close
              aria-label="Cerrar"
              className="rounded-sm p-1 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </header>

          <ul className="divide-y divide-[var(--color-border)]">
            {SHORTCUTS.map((s) => (
              <li
                key={s.keys.join("+")}
                className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
              >
                <span className="text-[var(--color-text-secondary)]">{s.label}</span>
                <span className="flex items-center gap-1">
                  {s.keys.map((k, i) => (
                    <kbd
                      key={`${k}-${i}`}
                      className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 font-mono text-[11px] font-medium text-[var(--color-text)] shadow-[0_1px_0_var(--color-border)]"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>

          <footer className="border-t border-[var(--color-border)] px-4 py-2.5 text-[11px] text-[var(--color-text-muted)]">
            Las flechas y <kbd className="font-mono">/</kbd> se ignoran mientras
            escribes en un input.
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
