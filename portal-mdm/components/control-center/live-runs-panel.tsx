"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCardFrame } from "./dashboard-card-frame";
import { useActiveCorridas } from "@/hooks/use-control-center";
import type { CorridaActiva } from "@/lib/schemas/etl-launch";

/** Returns "H:MM:SS" or "MM:SS" from a seconds count. */
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function RunRow({ run, now }: { run: CorridaActiva; now: number }) {
  const startedMs = run.fechaInicio ? new Date(run.fechaInicio).getTime() : null;
  const elapsedSec = startedMs ? Math.max(0, Math.floor((now - startedMs) / 1000)) : null;

  return (
    <li className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5">
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-info)] animate-pulse"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs text-[var(--color-text)]">
          {run.id}
        </p>
        {run.iniciadoPor ? (
          <p className="text-[11px] text-[var(--color-text-muted)]">
            por {run.iniciadoPor}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            run.estado === "EJECUTANDO"
              ? "bg-[var(--color-info-glow)] text-[var(--color-info)]"
              : "bg-[var(--color-warning-glow)] text-[var(--color-warning)]",
          )}
        >
          <Zap aria-hidden className="h-2.5 w-2.5" />
          {run.estado}
        </span>
        {elapsedSec !== null ? (
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
            {formatElapsed(elapsedSec)}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Shows currently running/queued ETL corridas.
 * Polling: 5s when active, 30s when idle (via useActiveCorridas adaptive interval).
 */
export function LiveRunsPanel() {
  const { data, isLoading } = useActiveCorridas();
  const now = useNow();

  const visible = (data ?? []).slice(0, 5);
  const extra = Math.max(0, (data ?? []).length - 5);

  return (
    <DashboardCardFrame
      title="Corridas activas"
      description="Procesos ETL en ejecución ahora"
      href="/etl-monitor"
    >
      {isLoading && !data ? (
        <ul className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 2 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5"
            >
              <Skeleton className="h-2 w-2 rounded-full shrink-0" />
              <Skeleton className="h-3.5 flex-1 rounded" />
              <Skeleton className="h-5 w-16 rounded shrink-0" />
            </li>
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <div className="flex items-center gap-2.5 py-2 text-sm">
          <ShieldCheck
            aria-hidden
            className="h-4 w-4 shrink-0 text-[var(--color-success)]"
          />
          <div>
            <p className="font-medium text-[var(--color-text)]">Sistema en reposo</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Sin corridas activas en este momento.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {visible.map((run) => (
            <RunRow key={run.id} run={run} now={now} />
          ))}
          {extra > 0 ? (
            <li className="px-1 text-xs text-[var(--color-text-muted)]">
              y {extra} más en cola…
            </li>
          ) : null}
        </ul>
      )}
    </DashboardCardFrame>
  );
}
