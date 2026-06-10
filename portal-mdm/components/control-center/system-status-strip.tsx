"use client";

import { cn } from "@/lib/utils";
import { useSystemHealth } from "@/hooks/use-control-center";
import type { StatusLevel } from "@/lib/schemas/control-center";

const LABEL: Record<string, string> = {
  etl: "ETL",
  dwh: "DWH",
  quality: "Calidad",
  alerts: "Alertas",
};

function pillClasses(level: StatusLevel | undefined): string {
  switch (level) {
    case "ok":
      return "bg-[var(--color-success-glow)] text-[var(--color-success)] border-[var(--color-success)]/30";
    case "warning":
      return "bg-[var(--color-warning-glow)] text-[var(--color-warning)] border-[var(--color-warning)]/30";
    case "critical":
      return "bg-[var(--color-destructive-glow)] text-[var(--color-destructive)] border-[var(--color-destructive)]/30";
    default:
      return "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)]";
  }
}

function dotClasses(level: StatusLevel | undefined): string {
  switch (level) {
    case "ok":
      return "bg-[var(--color-success)]";
    case "warning":
      return "bg-[var(--color-warning)]";
    case "critical":
      return "bg-[var(--color-destructive)] animate-pulse";
    default:
      return "bg-[var(--color-text-muted)]";
  }
}

function levelText(level: StatusLevel | undefined): string {
  switch (level) {
    case "ok": return "OK";
    case "warning": return "Aviso";
    case "critical": return "Crítico";
    default: return "—";
  }
}

/**
 * Inline status pills for the dashboard page header.
 * Shows ETL / DWH / Calidad / Alertas system health at a glance.
 * Dot pulses when any component is critical.
 */
export function SystemStatusStrip() {
  const { data } = useSystemHealth();

  const components: { key: "etl" | "dwh" | "quality" | "alerts"; level: StatusLevel | undefined }[] = [
    { key: "etl", level: data?.etl },
    { key: "dwh", level: data?.dwh },
    { key: "quality", level: data?.quality },
    { key: "alerts", level: data?.alerts },
  ];

  return (
    <div
      role="status"
      aria-label="Estado del sistema"
      className="flex flex-wrap items-center gap-1.5"
    >
      {components.map(({ key, level }) => (
        <span
          key={key}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
            pillClasses(level),
          )}
        >
          <span
            aria-hidden
            className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotClasses(level))}
          />
          {LABEL[key]}
          <span className="font-normal opacity-80">{levelText(level)}</span>
        </span>
      ))}
    </div>
  );
}
