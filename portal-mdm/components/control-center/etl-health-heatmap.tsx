"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useEtlRuns } from "@/hooks/use-control-center";
import { Skeleton } from "@/components/ui/skeleton";
import type { EtlRun } from "@/lib/schemas/control-center";

/* ------------------------------------------------------------------ types */

type CellStatus = EtlRun["status"] | "none";

// "worst wins" priority — higher number = worse, shown when multiple runs in a day
const PRIORITY: Record<string, number> = {
  failed: 4,
  running: 3,
  queued: 2,
  success: 1,
  canceled: 0,
  none: -1,
};

/* ------------------------------------------------------------------ utils */

function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

function toDate(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es", { weekday: "short", day: "numeric" });
}

/* ---------------------------------------------------------------- styles */

const CELL: Record<CellStatus, { bg: string; tooltip: string }> = {
  success: {
    bg: "bg-[var(--color-success)] opacity-80 hover:opacity-100",
    tooltip: "Éxito",
  },
  failed: {
    bg: "bg-[var(--color-destructive)] opacity-90 hover:opacity-100",
    tooltip: "Fallo",
  },
  running: {
    bg: "bg-[var(--color-info)] opacity-90 animate-pulse",
    tooltip: "En curso",
  },
  queued: {
    bg: "bg-[var(--color-warning)] opacity-60 hover:opacity-90",
    tooltip: "En cola",
  },
  canceled: {
    bg: "bg-[var(--color-text-muted)] opacity-30 hover:opacity-50",
    tooltip: "Cancelado",
  },
  none: {
    bg: "bg-[var(--color-surface-2)] opacity-70",
    tooltip: "Sin datos",
  },
};

/* --------------------------------------------------------------- component */

const HEATMAP_RUNS_LIMIT = 200;

export function EtlHealthHeatmap() {
  const { data: runs, isLoading } = useEtlRuns(HEATMAP_RUNS_LIMIT);

  const { days, rows } = useMemo(() => {
    const days = getLastNDays(14);
    const cutoff = days[0];

    if (!runs || runs.length === 0) return { days, rows: [] };

    // Only keep runs within the 14-day window
    const recent = runs.filter((r) => {
      const d = toDate(r.startedAt);
      return d !== null && d >= cutoff;
    });

    // Unique process names, sorted
    const names = [...new Set(recent.map((r) => r.name))].sort();

    // Build grid[name][date] = worst status
    const grid: Record<string, Record<string, string>> = {};
    for (const r of recent) {
      const d = toDate(r.startedAt);
      if (!d) continue;
      if (!grid[r.name]) grid[r.name] = {};
      const cur = grid[r.name][d];
      if ((PRIORITY[r.status] ?? 0) > (PRIORITY[cur] ?? -1)) {
        grid[r.name][d] = r.status;
      }
    }

    const rows = names.map((name) => ({
      name,
      cells: days.map((d) => (grid[name]?.[d] ?? "none") as CellStatus),
    }));

    return { days, rows };
  }, [runs]);

  if (isLoading) return <Skeleton className="h-36 rounded-md" />;
  if (rows.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse"
        aria-label="Mapa de salud ETL — últimos 14 días"
      >
        <thead>
          <tr>
            {/* process name column header */}
            <th className="w-44 py-1 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Proceso
            </th>
            {days.map((d) => (
              <th
                key={d}
                className={cn(
                  "px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide",
                  d === today
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)]",
                )}
              >
                {dayLabel(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ name, cells }) => (
            <tr key={name}>
              <td
                className="py-1 pr-3 font-mono text-[10px] text-[var(--color-text-secondary)]"
                title={name}
              >
                <span className="block max-w-[10rem] truncate">{name}</span>
              </td>
              {cells.map((status, i) => {
                const cfg = CELL[status];
                const d = days[i];
                return (
                  <td key={d} className="px-1 py-1 text-center">
                    <div
                      className={cn(
                        "mx-auto h-6 w-6 cursor-default rounded-sm transition-opacity",
                        cfg.bg,
                        d === today &&
                          "ring-1 ring-[var(--color-primary)]/50 ring-offset-1 ring-offset-[var(--color-surface)]",
                      )}
                      title={`${name} · ${d} · ${cfg.tooltip}`}
                      aria-label={`${name}, ${d}: ${cfg.tooltip}`}
                      role="img"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div
        role="list"
        aria-label="Leyenda"
        className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-[var(--color-text-muted)]"
      >
        {(["success", "failed", "running", "none"] as CellStatus[]).map((s) => (
          <div key={s} role="listitem" className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("h-3 w-3 rounded-sm", CELL[s].bg)}
            />
            <span>{CELL[s].tooltip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
