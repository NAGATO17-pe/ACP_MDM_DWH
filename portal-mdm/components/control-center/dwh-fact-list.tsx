"use client";

import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { DwhNode } from "@/lib/schemas/dwh";

interface DwhFactListProps {
  nodes: DwhNode[];
  selectedId: string | null;
  filter: string;
  onSelect: (id: string) => void;
}

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "destructive" | "default" | "info"
> = {
  ok: "success",
  warning: "warning",
  failed: "destructive",
  stale: "default",
  unknown: "default",
};

const LAYER_VARIANT: Record<string, "default" | "info" | "primary"> = {
  bronce: "default",
  silver: "info",
  gold: "primary",
};

/**
 * Vista tabular alternativa al grafo. Es la fuente accesible (screen
 * readers) y la primaria en pantallas pequeñas.
 */
export function DwhFactList({
  nodes,
  selectedId,
  filter,
  onSelect,
}: DwhFactListProps) {
  const lower = filter.trim().toLowerCase();
  const filtered = lower
    ? nodes.filter(
        (n) =>
          n.label.toLowerCase().includes(lower) ||
          n.fullName.toLowerCase().includes(lower) ||
          n.facts.some((f) => f.toLowerCase().includes(lower)),
      )
    : nodes;

  return (
    <div className="bg-surface overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Tablas del DWH agrupadas por capa, con su estado y métricas de las
          últimas 24 horas
        </caption>
        <thead className="bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          <tr className="border-b border-[var(--color-border)]">
            <th scope="col" className="px-4 py-3 font-semibold">
              Capa
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Tabla
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Estado
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Filas 24 h
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Rechazadas
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Última carga
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Facts
            </th>
            <th scope="col" className="w-8 px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]"
              >
                Sin tablas que coincidan con el filtro
              </td>
            </tr>
          ) : (
            filtered.map((n, idx) => {
              const selected = selectedId === n.id;
              return (
                <tr
                  key={n.id}
                  className={cn(
                    "cursor-pointer border-b border-[var(--color-border)] transition-colors",
                    idx % 2 === 1 && "bg-[var(--color-surface-2)]/30",
                    selected
                      ? "bg-[color-mix(in_oklab,var(--color-primary)_10%,transparent)]"
                      : "hover:bg-[var(--color-surface-2)]",
                  )}
                  onClick={() => onSelect(n.id)}
                >
                  <td className="px-4 py-3">
                    <Badge variant={LAYER_VARIANT[n.layer]}>
                      {n.layer === "bronce"
                        ? "Bronce"
                        : n.layer === "silver"
                          ? "Silver"
                          : "Gold"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="font-mono text-xs text-[var(--color-text)]"
                      title={n.fullName}
                    >
                      {n.fullName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[n.status]}>
                      {n.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums text-xs">
                      {formatNumber(n.rowsLast24h)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "tabular-nums text-xs",
                        n.rejectedLast24h > 0 &&
                          "font-medium text-[var(--color-warning)]",
                      )}
                    >
                      {formatNumber(n.rejectedLast24h)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {n.lastLoadAt ? (
                      <span className="tabular-nums text-xs text-[var(--color-text-muted)]">
                        {formatDateTime(n.lastLoadAt)}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs text-[var(--color-text-secondary)]"
                      title={n.facts.join(", ")}
                    >
                      {n.facts.length === 0
                        ? "—"
                        : n.facts.length === 1
                          ? n.facts[0]
                          : `${n.facts.length} facts`}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <ChevronRight
                      aria-hidden
                      className="h-4 w-4 text-[var(--color-text-muted)]"
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
