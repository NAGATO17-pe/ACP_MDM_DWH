"use client";

/**
 * components/control-center/dwh-saved-views-menu.tsx
 * ==================================================
 * Dropdown del DWH para listar / restaurar / borrar / guardar "vistas":
 * combinaciones nombradas de filtros + densidad + selección.
 *
 * Compuesto con Radix DropdownMenu. La acción "Guardar vista actual…"
 * abre un mini-prompt inline (input + 2 botones) — sin Dialog, para no
 * romper la pila de focus del menú padre.
 */

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bookmark, BookmarkPlus, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSavedViews, type SavedView } from "@/hooks/use-saved-views";
import type { DwhUrlSnapshot } from "@/app/(admin)/dwh/use-dwh-url-state";

interface DwhSavedViewsMenuProps {
  takeSnapshot: () => DwhUrlSnapshot;
  applySnapshot: (s: DwhUrlSnapshot) => void;
}

export function DwhSavedViewsMenu({
  takeSnapshot,
  applySnapshot,
}: DwhSavedViewsMenuProps) {
  const { views, save, remove, remaining } = useSavedViews();
  const [open, setOpen] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const [draftName, setDraftName] = useState("");

  function commit() {
    const snap = takeSnapshot();
    const created = save(draftName, snap);
    if (created) {
      setDraftName("");
      setPrompting(false);
      setOpen(false);
    }
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Vistas guardadas"
          title="Vistas guardadas"
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
            views.length > 0
              ? "border-[color-mix(in_oklab,var(--color-primary)_30%,transparent)] bg-[color-mix(in_oklab,var(--color-primary)_6%,transparent)] text-[var(--color-primary)]"
              : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]",
          )}
        >
          <Bookmark aria-hidden className="h-3.5 w-3.5" />
          Vistas
          {views.length > 0 ? (
            <span className="tabular-nums">({views.length})</span>
          ) : null}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[260px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          {views.length === 0 ? (
            <div className="px-3 py-3 text-xs italic text-[var(--color-text-muted)]">
              No tienes vistas guardadas. Configura filtros y guarda la combinación.
            </div>
          ) : (
            <DropdownMenu.Group>
              {views.map((v) => (
                <ViewRow
                  key={v.id}
                  view={v}
                  onApply={() => {
                    applySnapshot(v.snapshot);
                    setOpen(false);
                  }}
                  onRemove={() => remove(v.id)}
                />
              ))}
            </DropdownMenu.Group>
          )}

          <DropdownMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />

          {prompting ? (
            <div className="flex items-center gap-1 p-1.5">
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commit();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setPrompting(false);
                    setDraftName("");
                  }
                }}
                maxLength={60}
                placeholder="Nombre de la vista…"
                className="h-7 min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
              />
              <button
                type="button"
                onClick={commit}
                disabled={!draftName.trim()}
                aria-label="Guardar"
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--color-primary)] transition hover:bg-[var(--color-surface-2)] disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                if (remaining > 0) setPrompting(true);
              }}
              disabled={remaining === 0}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs outline-none",
                "data-[highlighted]:bg-[var(--color-surface-2)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40",
              )}
            >
              <BookmarkPlus aria-hidden className="h-3.5 w-3.5" />
              <span>Guardar vista actual…</span>
              <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                {remaining}/{remaining + views.length}
              </span>
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ViewRow({
  view,
  onApply,
  onRemove,
}: {
  view: SavedView;
  onApply: () => void;
  onRemove: () => void;
}) {
  const snap = view.snapshot;
  const summary = buildSummary(snap);
  return (
    <DropdownMenu.Item
      onSelect={(e) => {
        e.preventDefault();
        onApply();
      }}
      className="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-[var(--color-surface-2)]"
    >
      <Bookmark aria-hidden className="h-3.5 w-3.5 text-[var(--color-primary)]" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[var(--color-text)]">{view.name}</span>
        <span className="truncate text-[10px] text-[var(--color-text-muted)]">
          {summary}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Borrar vista ${view.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="invisible inline-flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-muted)] transition hover:bg-[color-mix(in_oklab,var(--color-destructive)_18%,transparent)] hover:text-[var(--color-destructive)] group-hover:visible group-focus-within:visible focus-visible:visible"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </DropdownMenu.Item>
  );
}

function buildSummary(snap: DwhUrlSnapshot): string {
  const parts: string[] = [];
  if (snap.q) parts.push(`"${snap.q}"`);
  if (snap.statuses.length > 0 && snap.statuses.length < 5)
    parts.push(`status: ${snap.statuses.join("/")}`);
  if (snap.collapsed.length > 0)
    parts.push(`colapsado: ${snap.collapsed.join("/")}`);
  if (snap.view !== "lineage") parts.push(`vista ${snap.view}`);
  if (snap.density === "compact") parts.push("compacta");
  return parts.length > 0 ? parts.join(" · ") : "sin filtros";
}
