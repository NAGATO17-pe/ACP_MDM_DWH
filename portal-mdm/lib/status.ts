/**
 * lib/status.ts
 * =============
 * Single source of truth para mapear niveles/estados a tono visual.
 *
 * Antes de este archivo, el mismo switch `level → color` vivía en:
 *  - components/layout/role-shell.tsx (toneFor)
 *  - components/control-center/etl-status-badge.tsx
 *  - components/control-center/bitacora-status-badge.tsx
 *  - components/control-center/severity-chip.tsx
 *
 * Cualquier cambio de paleta o iconografía de estado se hace acá y
 * se propaga en todo el portal vía `<StatusBadge>` y los helpers.
 */

import {
  AlertCircle,
  AlertOctagon,
  CheckCircle2,
  Info,
  Loader2,
  SkipForward,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import type { StatusLevel } from "@/lib/schemas/control-center";

/* -------------------------------------------------------------------------- */
/* Niveles canónicos                                                          */
/* -------------------------------------------------------------------------- */

export type Tone = "ok" | "warning" | "critical" | "info" | "neutral";

export interface ToneDef {
  /** Token CSS de color base (nombre de la variable, sin envolver). */
  cssVar: string;
  /** Clase tailwind para color de texto. */
  text: string;
  /** Clase tailwind para fondo sólido. */
  bg: string;
  /** Fondo tonal mezclado con surface-2 (~8 %). */
  tint: string;
  /** Borde tonal (~30 % mezcla). */
  ring: string;
  /** Icono recomendado. */
  icon: LucideIcon;
  /** Label en español. */
  label: string;
}

export const TONE: Record<Tone, ToneDef> = {
  ok: {
    cssVar: "--color-success",
    text: "text-[var(--color-success)]",
    bg: "bg-[var(--color-success)]",
    tint: "bg-[color-mix(in_oklab,var(--color-success)_8%,var(--color-surface-2))]",
    ring: "border-[color-mix(in_oklab,var(--color-success)_30%,transparent)]",
    icon: CheckCircle2,
    label: "OK",
  },
  warning: {
    cssVar: "--color-warning",
    text: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-warning)]",
    tint: "bg-[color-mix(in_oklab,var(--color-warning)_8%,var(--color-surface-2))]",
    ring: "border-[color-mix(in_oklab,var(--color-warning)_30%,transparent)]",
    icon: TriangleAlert,
    label: "Advertencia",
  },
  critical: {
    cssVar: "--color-destructive",
    text: "text-[var(--color-destructive)]",
    bg: "bg-[var(--color-destructive)]",
    tint: "bg-[color-mix(in_oklab,var(--color-destructive)_8%,var(--color-surface-2))]",
    ring: "border-[color-mix(in_oklab,var(--color-destructive)_30%,transparent)]",
    icon: AlertOctagon,
    label: "Crítico",
  },
  info: {
    cssVar: "--color-info",
    text: "text-[var(--color-info)]",
    bg: "bg-[var(--color-info)]",
    tint: "bg-[color-mix(in_oklab,var(--color-info)_8%,var(--color-surface-2))]",
    ring: "border-[color-mix(in_oklab,var(--color-info)_30%,transparent)]",
    icon: Info,
    label: "Informativo",
  },
  neutral: {
    cssVar: "--color-text-muted",
    text: "text-[var(--color-text-muted)]",
    bg: "bg-[var(--color-text-muted)]",
    tint: "bg-[var(--color-surface-2)]",
    ring: "border-[var(--color-border)]",
    icon: AlertCircle,
    label: "—",
  },
};

/* -------------------------------------------------------------------------- */
/* Mapeos desde dominios del backend                                          */
/* -------------------------------------------------------------------------- */

/** StatusLevel del schema (ok/warning/critical) → Tone. */
export function toneFromLevel(level: StatusLevel): Tone {
  return level;
}

/** CorridaStatus (success/running/failed/queued/canceled) → Tone + label + spin. */
export function toneFromCorrida(
  status: "success" | "running" | "failed" | "queued" | "canceled",
): { tone: Tone; label: string; icon: LucideIcon; spin?: boolean } {
  switch (status) {
    case "success":
      return { tone: "ok", label: "OK", icon: CheckCircle2 };
    case "running":
      return { tone: "info", label: "Ejecutando", icon: Loader2, spin: true };
    case "failed":
      return { tone: "critical", label: "Error", icon: XCircle };
    case "queued":
      return { tone: "warning", label: "Pendiente", icon: AlertCircle };
    case "canceled":
      return { tone: "neutral", label: "Cancelado", icon: SkipForward };
  }
}

/** Estado libre de bitácora (OK / ERROR / EN_PROCESO / SKIPPED / TIMEOUT) → Tone. */
export function toneFromBitacora(
  estado: string,
): { tone: Tone; label: string; icon: LucideIcon; spin?: boolean } {
  switch (estado) {
    case "OK":
      return { tone: "ok", label: "OK", icon: CheckCircle2 };
    case "ERROR":
      return { tone: "critical", label: "Error", icon: XCircle };
    case "EN_PROCESO":
      return { tone: "info", label: "En proceso", icon: Loader2, spin: true };
    case "SKIPPED":
      return { tone: "warning", label: "Omitido", icon: SkipForward };
    case "TIMEOUT":
      return { tone: "critical", label: "Timeout", icon: AlertCircle };
    default:
      return { tone: "neutral", label: estado, icon: AlertCircle };
  }
}

/** Severity de alerta (critical/warning/info) → Tone. */
export function toneFromSeverity(
  severity: "critical" | "warning" | "info",
): Tone {
  return severity;
}

/* -------------------------------------------------------------------------- */
/* Compat — usado por imports legacy de role-shell.statusTone                 */
/* -------------------------------------------------------------------------- */

export function statusTone(level: StatusLevel) {
  const t = TONE[level];
  return { text: t.text, bg: t.bg };
}
