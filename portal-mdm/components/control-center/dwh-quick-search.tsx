"use client";

/**
 * components/control-center/dwh-quick-search.tsx
 * ==============================================
 * Paleta de búsqueda rápida (⌘K / Ctrl+K) acotada al DWH.
 *
 * Lista los nodos visibles filtrados por una query simple (substring case
 * insensitive sobre label, fullName y facts). Cada item muestra:
 *   - status dot
 *   - layer pill (Bronce/Silver/Gold)
 *   - nombre (fullName)
 *   - count de facts asociados
 *
 * Atajos internos: ↑/↓ navegan, Enter selecciona+cierra, Esc cierra.
 *
 * Implementado con Radix Dialog para mantener focus-trap accesible sin
 * dependencias extra.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DwhNode, TableStatus } from "@/lib/schemas/dwh";

interface DwhQuickSearchProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nodes: DwhNode[];
  onSelect: (id: string) => void;
}

const STATUS_DOT: Record<TableStatus, string> = {
  ok: "var(--color-success)",
  warning: "var(--color-warning)",
  failed: "var(--color-destructive)",
  stale: "var(--color-text-muted)",
  unknown: "var(--color-text-muted)",
};

const LAYER_LABEL = { bronce: "Bronce", silver: "Silver", gold: "Gold" } as const;

const MAX_RESULTS = 30;

export function DwhQuickSearch({
  open,
  onOpenChange,
  nodes,
  onSelect,
}: DwhQuickSearchProps) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Resultados rankeados: exact-prefix > substring fullName > substring facts.
  const results = useMemo(() => {
    const lower = q.trim().toLowerCase();
    if (!lower) return nodes.slice(0, MAX_RESULTS);
    const scored: { node: DwhNode; score: number }[] = [];
    for (const n of nodes) {
      const lbl = n.label.toLowerCase();
      const full = n.fullName.toLowerCase();
      let score = -1;
      if (lbl.startsWith(lower)) score = 100;
      else if (full.startsWith(lower)) score = 80;
      else if (lbl.includes(lower)) score = 60;
      else if (full.includes(lower)) score = 50;
      else if (n.facts.some((f) => f.toLowerCase().includes(lower))) score = 30;
      if (score > 0) scored.push({ node: n, score });
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((s) => s.node);
  }, [nodes, q]);

  // Reset al abrir.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQ("");
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Mantener `active` dentro de rango cuando cambian los resultados.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (active >= results.length) setActive(Math.max(0, results.length - 1));
  }, [active, results.length]);

  // Auto-scroll del item activo dentro de la lista.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    item?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const r = results[active];
      if (r) {
        e.preventDefault();
        onSelect(r.id);
        onOpenChange(false);
      }
    }
  }

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
          onKeyDown={onKeyDown}
          className={cn(
            "fixed left-1/2 top-[20%] z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2",
            "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <Dialog.Title className="sr-only">
            Búsqueda rápida del DWH
          </Dialog.Title>

          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
            <Search
              aria-hidden
              className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]"
            />
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              placeholder="Buscar tabla, fact o mart…"
              className="h-8 min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
              aria-label="Buscar en el DWH"
            />
            <kbd className="hidden h-5 items-center rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 font-mono text-[10px] text-[var(--color-text-muted)] sm:inline-flex">
              Esc
            </kbd>
          </div>

          <ul
            ref={listRef}
            role="listbox"
            className="max-h-[55vh] overflow-y-auto py-1"
          >
            {results.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs italic text-[var(--color-text-muted)]">
                Sin coincidencias para “{q}”
              </li>
            ) : (
              results.map((n, idx) => {
                const isActive = idx === active;
                return (
                  <li
                    key={n.id}
                    data-idx={idx}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => {
                      onSelect(n.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-xs",
                      isActive
                        ? "bg-[color-mix(in_oklab,var(--color-primary)_10%,transparent)]"
                        : "hover:bg-[var(--color-surface-2)]",
                    )}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: STATUS_DOT[n.status] }}
                    />
                    <span
                      className={cn(
                        "inline-flex h-4 shrink-0 items-center rounded px-1.5 text-[10px] font-medium",
                        n.layer === "bronce" &&
                          "bg-[color-mix(in_oklab,#b08a4a_18%,transparent)] text-[#d4a866]",
                        n.layer === "silver" &&
                          "bg-[color-mix(in_oklab,var(--color-info)_18%,transparent)] text-[var(--color-info)]",
                        n.layer === "gold" &&
                          "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
                      )}
                    >
                      {LAYER_LABEL[n.layer]}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[var(--color-text)]">
                      {n.fullName}
                    </span>
                    {n.facts.length > 0 ? (
                      <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-text-muted)]">
                        {n.facts.length} fact{n.facts.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>

          <footer className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-3 py-1.5 text-[10px] text-[var(--color-text-muted)]">
            <span>
              {results.length} resultado{results.length === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-2">
              <Hint k="↑↓" label="navegar" />
              <Hint k="Enter" label="abrir" />
              <Hint k="Esc" label="cerrar" />
            </span>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Hint({ k, label }: { k: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1 font-mono text-[9px]">
        {k}
      </kbd>
      <span>{label}</span>
    </span>
  );
}
