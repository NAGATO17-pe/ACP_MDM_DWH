"use client";

import { AlertTriangle, ArrowRight, ShieldCheck, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DashboardCardFrame } from "./dashboard-card-frame";
import { useActiveAlerts } from "@/hooks/use-control-center";
import type { Alert } from "@/lib/schemas/control-center";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

function AlertRow({ alert }: { alert: Alert }) {
  const isCritical = alert.severity === "critical";
  const isWarning = alert.severity === "warning";

  const Icon = isCritical ? XCircle : isWarning ? AlertTriangle : ShieldCheck;
  const toneText = isCritical
    ? "text-[var(--color-destructive)]"
    : isWarning
      ? "text-[var(--color-warning)]"
      : "text-[var(--color-info)]";
  const rowBg = isCritical
    ? "bg-[color-mix(in_oklab,var(--color-destructive)_8%,var(--color-surface-2))] border-l-[var(--color-destructive)]"
    : isWarning
      ? "bg-[color-mix(in_oklab,var(--color-warning)_8%,var(--color-surface-2))] border-l-[var(--color-warning)]"
      : "bg-[var(--color-surface-2)] border-l-[var(--color-border)]";

  return (
    <li
      className={cn(
        "flex items-start gap-2.5 rounded-md border border-[var(--color-border)] border-l-4 px-3 py-2",
        rowBg,
        alert.acknowledged ? "opacity-50" : "",
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", toneText)} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-tight text-[var(--color-text)]">
          {alert.source}
        </p>
        <p className="truncate text-[11px] text-[var(--color-text-secondary)]">
          {alert.message}
        </p>
      </div>
      <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-text-muted)]">
        {timeAgo(alert.createdAt)}
      </span>
    </li>
  );
}

/**
 * Live alert feed — latest 5 alerts, sorted by createdAt desc.
 * Refetches every 60 seconds via useActiveAlerts default interval.
 */
export function AlertFeedLive() {
  const { data, isLoading, isError } = useActiveAlerts();

  const sorted = [...(data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const visible = sorted.slice(0, 5);

  const level =
    (data ?? []).some((a) => a.severity === "critical" && !a.acknowledged)
      ? "critical" as const
      : (data ?? []).some((a) => a.severity === "warning" && !a.acknowledged)
        ? "warning" as const
        : undefined;

  return (
    <DashboardCardFrame
      title="Alertas recientes"
      description="Últimas 5 alertas del sistema"
      href="/alerts"
      level={level}
    >
      {isLoading && !data ? (
        <ul className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 rounded-md border border-[var(--color-border)] px-3 py-2"
            >
              <Skeleton className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-1/3 rounded" />
                <Skeleton className="h-3 w-4/5 rounded" />
              </div>
              <Skeleton className="h-3 w-10 shrink-0 rounded" />
            </li>
          ))}
        </ul>
      ) : isError ? (
        <p className="text-sm text-[var(--color-destructive)]">
          No se pudieron cargar las alertas.
        </p>
      ) : visible.length === 0 ? (
        <div className="flex items-center gap-2.5 py-2 text-sm">
          <ShieldCheck
            aria-hidden
            className="h-4 w-4 shrink-0 text-[var(--color-success)]"
          />
          <p className="font-medium text-[var(--color-text)]">Sin alertas activas</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-live="polite" aria-label="Alertas recientes">
            {visible.map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </ul>
          <span
            aria-hidden
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)]"
          >
            Ver todas
            <ArrowRight aria-hidden className="h-3 w-3" />
          </span>
        </>
      )}
    </DashboardCardFrame>
  );
}
