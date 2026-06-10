"use client";

/**
 * components/control-center/live-heartbeat.tsx
 * =============================================
 * Indicador visual de "vida" del runner. Reemplaza al texto plano
 * `lastHeartbeat: 2026-06-04 14:32` por un dot pulsante con tono según
 * la edad del último heartbeat.
 *
 * Reglas:
 *   - inactive  → dot gris, sin pulse, label "—"           (no aplica)
 *   - alive     → dot verde pulsante                        (heartbeat < 30s)
 *   - slow      → dot ámbar pulsante                        (30s ≤ heartbeat < 120s)
 *   - dead      → dot rojo solid + texto en destacado       (heartbeat ≥ 120s)
 *
 * Importante: respeta `prefers-reduced-motion` vía el reset global.
 */

import { cn } from "@/lib/utils";
import { useTickingNow, formatRelativeAgo } from "@/hooks/use-ticking-now";

export type LiveStatus = "inactive" | "alive" | "slow" | "dead";

interface LiveHeartbeatProps {
  /** ISO del último heartbeat. */
  lastHeartbeat: string | null;
  /** Si la corrida ya no está activa (success/failed/canceled), forzar inactive. */
  isActive: boolean;
  /** Mostrar el texto "hace Xs" al lado. */
  showLabel?: boolean;
  /** Etiqueta personalizada cuando inactive (default: "—"). */
  inactiveLabel?: string;
  /** Tamaño visual. */
  size?: "sm" | "md";
  className?: string;
}

const SIZE_DOT = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
} as const;

const SIZE_TEXT = {
  sm: "text-[11px]",
  md: "text-xs",
} as const;

export function LiveHeartbeat({
  lastHeartbeat,
  isActive,
  showLabel = true,
  inactiveLabel = "—",
  size = "md",
  className,
}: LiveHeartbeatProps) {
  // Tick cada segundo cuando hay un heartbeat — cuando no, no necesitamos
  // refrescar; los inactive sólo cambian con un nuevo render del padre.
  const now = useTickingNow(isActive && lastHeartbeat ? 1000 : 60_000);
  const status = deriveStatus(lastHeartbeat, isActive, now);
  const label = computeLabel(status, lastHeartbeat, now, inactiveLabel);

  return (
    <span
      aria-label={ariaLabel(status, lastHeartbeat, now)}
      className={cn(
        "inline-flex items-center gap-1.5 tabular-nums",
        SIZE_TEXT[size],
        statusTextClass(status),
        className,
      )}
      data-live-status={status}
    >
      <span aria-hidden className="relative inline-flex">
        <span className={cn("inline-block rounded-full", SIZE_DOT[size], statusDotClass(status))} />
        {status === "alive" || status === "slow" ? (
          <span
            className={cn(
              "absolute inset-0 inline-block rounded-full opacity-60",
              statusDotClass(status),
              "animate-[live-ping_1.6s_ease-out_infinite]",
            )}
          />
        ) : null}
      </span>
      {showLabel ? <span>{label}</span> : null}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

function deriveStatus(
  iso: string | null,
  isActive: boolean,
  now: number,
): LiveStatus {
  if (!isActive) return "inactive";
  if (!iso) return "dead";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "dead";
  const ageMs = now - t;
  if (ageMs < 30_000) return "alive";
  if (ageMs < 120_000) return "slow";
  return "dead";
}

function computeLabel(
  status: LiveStatus,
  iso: string | null,
  now: number,
  inactiveLabel: string,
): string {
  if (status === "inactive") return inactiveLabel;
  if (status === "dead" && !iso) return "sin señal";
  const ago = formatRelativeAgo(iso, now);
  if (status === "alive") return `vivo · ${ago}`;
  if (status === "slow") return `lento · ${ago}`;
  return `sin señal · ${ago}`;
}

function statusDotClass(status: LiveStatus): string {
  switch (status) {
    case "alive":
      return "bg-[var(--color-success)]";
    case "slow":
      return "bg-[var(--color-warning)]";
    case "dead":
      return "bg-[var(--color-destructive)]";
    case "inactive":
      return "bg-[var(--color-text-muted)]";
  }
}

function statusTextClass(status: LiveStatus): string {
  switch (status) {
    case "alive":
      return "text-[var(--color-success)]";
    case "slow":
      return "text-[var(--color-warning)]";
    case "dead":
      return "text-[var(--color-destructive)] font-medium";
    case "inactive":
      return "text-[var(--color-text-muted)]";
  }
}

function ariaLabel(
  status: LiveStatus,
  iso: string | null,
  now: number,
): string {
  if (status === "inactive") return "Runner inactivo";
  const ago = formatRelativeAgo(iso, now);
  if (status === "alive") return `Runner vivo, último heartbeat ${ago}`;
  if (status === "slow")
    return `Runner respondiendo lento, último heartbeat ${ago}`;
  return `Runner sin señal, último heartbeat ${ago}`;
}
