"use client";

/**
 * components/control-center/dwh-compare-panel.tsx
 * ===============================================
 * Panel side-rail dividido en 2 columnas que compara dos nodos del DWH.
 *
 * Útil para el caso clásico de migración: "un fact pasó de un upstream a
 * otro, ¿el nuevo está al nivel del viejo?". Muestra las mismas métricas
 * alineadas y marca cuál columna gana (más filas → verde sutil, más
 * rechazos → rojo sutil).
 *
 * Reemplaza al `DwhFactPanel` cuando `compareId != null`.
 */

import { ArrowLeftRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { DwhNode, TableStatus } from "@/lib/schemas/dwh";
import type { Tone } from "@/lib/status";

interface DwhComparePanelProps {
  a: DwhNode;
  b: DwhNode;
  onSwap: () => void;
  onClose: () => void;
  className?: string;
}

const STATUS_TONE: Record<TableStatus, Tone> = {
  ok: "ok",
  warning: "warning",
  failed: "critical",
  stale: "neutral",
  unknown: "neutral",
};

const LAYER_LABEL = { bronce: "Bronce", silver: "Silver", gold: "Gold" } as const;

export function DwhComparePanel({
  a,
  b,
  onSwap,
  onClose,
  className,
}: DwhComparePanelProps) {
  return (
    <aside
      aria-label={`Comparación entre ${a.fullName} y ${b.fullName}`}
      className={cn(
        "bg-surface flex h-full min-h-0 flex-col rounded-lg border border-[var(--color-border)] shadow-sm",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Badge variant="info">Comparar</Badge>
          <span className="truncate text-xs text-[var(--color-text-muted)]">
            2 nodos · misma escala
          </span>
        </div>
        <button
          type="button"
          aria-label="Intercambiar columnas"
          title="Intercambiar A ↔ B"
          onClick={onSwap}
          className="rounded-sm p-1 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Cerrar comparación"
          onClick={onClose}
          className="rounded-sm p-1 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="grid flex-1 grid-cols-2 overflow-y-auto">
        <Column node={a} side="left" />
        <Column node={b} side="right" />
      </div>

      <ComparisonStrip a={a} b={b} />
    </aside>
  );
}

function Column({ node, side }: { node: DwhNode; side: "left" | "right" }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 p-3",
        side === "left" ? "border-r border-[var(--color-border)]" : "",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="info">{LAYER_LABEL[node.layer]}</Badge>
        <StatusBadge
          tone={STATUS_TONE[node.status]}
          label={node.status.toUpperCase()}
          variant="pill"
          size="sm"
        />
      </div>
      <h3
        className="break-all font-mono text-xs font-semibold text-[var(--color-text)]"
        title={node.fullName}
      >
        {node.fullName}
      </h3>
      <dl className="flex flex-col gap-2">
        <Metric
          label="Filas 24h"
          value={formatNumber(node.rowsLast24h)}
        />
        <Metric
          label="Rechazadas 24h"
          value={formatNumber(node.rejectedLast24h)}
          warn={node.rejectedLast24h > 0}
        />
        <Metric
          label="Última carga"
          value={node.lastLoadAt ? formatDateTime(node.lastLoadAt) : "—"}
        />
        <Metric
          label="Facts"
          value={
            node.facts.length === 0
              ? "—"
              : node.facts.length === 1
                ? node.facts[0].replace(/^Fact_/, "")
                : `${node.facts.length} asociados`
          }
        />
      </dl>
    </div>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums text-sm font-semibold",
          warn ? "text-[var(--color-warning)]" : "text-[var(--color-text)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ComparisonStrip({ a, b }: { a: DwhNode; b: DwhNode }) {
  // Resumen rápido de "quién está mejor" en cada eje.
  const rowsDelta = a.rowsLast24h - b.rowsLast24h;
  const rejectedDelta = a.rejectedLast24h - b.rejectedLast24h;
  const ageA = a.lastLoadAt ? Date.parse(a.lastLoadAt) : 0;
  const ageB = b.lastLoadAt ? Date.parse(b.lastLoadAt) : 0;
  const recencyDelta = ageA - ageB; // positivo = A más reciente

  return (
    <footer className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-4 py-2 text-[11px]">
      <span className="text-[var(--color-text-muted)]">Diferencia A − B:</span>
      <Pill
        label="filas"
        value={signed(rowsDelta)}
        tone={rowsDelta === 0 ? "neutral" : rowsDelta > 0 ? "ok" : "bad"}
      />
      <Pill
        label="rechazadas"
        value={signed(rejectedDelta)}
        tone={
          rejectedDelta === 0 ? "neutral" : rejectedDelta < 0 ? "ok" : "bad"
        }
      />
      <Pill
        label="recencia"
        value={
          a.lastLoadAt && b.lastLoadAt
            ? signed(Math.round(recencyDelta / 3_600_000)) + "h"
            : "—"
        }
        tone={
          !a.lastLoadAt || !b.lastLoadAt
            ? "neutral"
            : recencyDelta === 0
              ? "neutral"
              : recencyDelta > 0
                ? "ok"
                : "bad"
        }
      />
    </footer>
  );
}

function signed(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? `+${formatNumber(n)}` : `−${formatNumber(Math.abs(n))}`;
}

function Pill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "bad" | "neutral";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono tabular-nums",
        tone === "ok" &&
          "border-[color-mix(in_oklab,var(--color-success)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-success)_8%,transparent)] text-[var(--color-success)]",
        tone === "bad" &&
          "border-[color-mix(in_oklab,var(--color-destructive)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-destructive)_8%,transparent)] text-[var(--color-destructive)]",
        tone === "neutral" &&
          "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
      )}
    >
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span>{value}</span>
    </span>
  );
}
