"use client";

import { Database } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useFactFreshness } from "@/hooks/use-control-center";

/**
 * Tabla de frescura de datos por fact.
 *
 * Muestra el nombre de cada fact del catálogo ETL y el tiempo transcurrido
 * desde su última carga exitosa. Resalta en amarillo las facts sin cargas
 * en las últimas 26 horas y en muted las que no tienen ningún registro.
 *
 * Conectada a GET /api/cc/dwh/facts — retorna FactFreshness[].
 */
export function DataFreshnessTable() {
  const { data, isLoading, isError } = useFactFreshness();

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-1.5 pt-1" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full rounded" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
        <Database
          aria-hidden
          className="h-6 w-6 text-[var(--color-text-muted)] opacity-40"
        />
        <p className="text-[12px] text-[var(--color-text-muted)]">
          Frescura por fact no disponible
        </p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
        <Database
          aria-hidden
          className="h-6 w-6 text-[var(--color-text-muted)] opacity-40"
        />
        <p className="text-[12px] text-[var(--color-text-muted)]">
          Sin facts registradas
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 pt-1">
      {data.map((row) => {
        const stale = isStale(row.lastSuccessAt);
        return (
          <div
            key={row.name}
            className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <span
              className="truncate font-mono text-[11px] text-[var(--color-text-muted)]"
              title={row.name}
            >
              {row.name}
            </span>
            <span
              className={cn(
                "shrink-0 tabular-nums",
                row.lastSuccessAt === null
                  ? "text-[var(--color-text-muted)] opacity-50"
                  : stale
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-text-muted)]",
              )}
            >
              {row.lastSuccessAt === null ? "Sin cargas" : timeAgo(row.lastSuccessAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Returns true when the last success is older than 26 hours (or null). */
function isStale(iso: string | null): boolean {
  if (!iso) return true;
  const diff = Date.now() - new Date(iso).getTime();
  return diff > 26 * 60 * 60 * 1000;
}

/** Compact relative-time formatter (es-PE). */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}
