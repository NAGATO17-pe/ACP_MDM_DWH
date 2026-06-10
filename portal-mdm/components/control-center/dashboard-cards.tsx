"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCardFrame } from "./dashboard-card-frame";
import { DataFreshnessTable } from "./data-freshness-table";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import {
  useDwhState,
  useEtlTrend,
  useQualityKpis,
  useSystemHealth,
} from "@/hooks/use-control-center";
import type { StatusLevel } from "@/lib/schemas/control-center";

/**
 * Recharts pesa ~400 KB (sin gzip) y antes entraba al bundle inicial
 * del `/dashboard`. Lo lazificamos vía `next/dynamic` con `ssr:false`:
 * el HTML del primer paint trae todos los datos hidratados, y la JS
 * de los charts llega en un chunk separado mientras el usuario ya
 * está viendo los números.
 */
const EtlTrendChart = dynamic(
  () => import("./etl-trend-chart").then((m) => m.EtlTrendChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[260px] rounded-md" />,
  },
);

const QualityPieChart = dynamic(
  () => import("./quality-pie-chart").then((m) => m.QualityPieChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[150px] rounded-md" />,
  },
);

/* ------------------------------------------------------------------ utils */

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

function ErrorState({
  onRetry,
  error,
}: {
  onRetry: () => void;
  error?: unknown;
}) {
  const msg =
    error instanceof Error
      ? error.message
      : "El backend no respondió o devolvió un error.";
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-md border border-[var(--color-destructive)]/40 bg-[var(--color-surface-2)] p-4 text-sm"
    >
      <div className="flex items-center gap-2 text-[var(--color-destructive)]">
        <AlertTriangle aria-hidden className="h-4 w-4" />
        <span className="font-medium">No se pudo cargar</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
        {msg}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw aria-hidden className="h-3.5 w-3.5" />
        Reintentar
      </Button>
    </div>
  );
}

/**
 * Nivel agregado para el border-l de cada card (V2).
 * Si la sección de salud está cargando o erroró, no aplicamos tono.
 */
function pickLevel(
  data: { etl?: StatusLevel; dwh?: StatusLevel; quality?: StatusLevel; alerts?: StatusLevel } | undefined,
  key: "etl" | "dwh" | "quality" | "alerts",
): StatusLevel | undefined {
  return data?.[key];
}

/* -------------------------------------------------------- 4. Tendencia ETL */

export function EtlTrendCard() {
  const { data: health } = useSystemHealth();
  const level = pickLevel(health, "etl");

  const [range, setRange] = useState<7 | 14 | 30>(14);
  const { data, isLoading, isError, error, refetch } = useEtlTrend(range);

  const wow = useMemo(() => {
    const mid = Math.floor(range / 2);
    if (!data || data.length < range) return null;
    const prevFailed = data.slice(0, mid).reduce((s, p) => s + p.failed, 0);
    const currFailed = data.slice(mid).reduce((s, p) => s + p.failed, 0);
    if (prevFailed === 0 && currFailed === 0) return { pct: 0, improved: true };
    if (prevFailed === 0) return { pct: 100, improved: false };
    const pct = Math.round(((currFailed - prevFailed) / prevFailed) * 100);
    return { pct, improved: pct <= 0 };
  }, [data, range]);

  return (
    <DashboardCardFrame
      title="Tendencia ETL"
      description="Corridas exitosas vs. fallidas por día"
      href="/etl-monitor"
      level={level}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        {/* Range selector */}
        <div
          role="group"
          aria-label="Rango de tendencia"
          className="flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5"
        >
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setRange(d)}
              aria-pressed={range === d}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium transition-colors min-w-[36px]",
                range === d
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* WoW badge */}
        {wow ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--color-text-muted)]">vs. período anterior:</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium tabular-nums",
                wow.improved
                  ? "bg-[color-mix(in_oklab,var(--color-success)_15%,transparent)] text-[var(--color-success)]"
                  : "bg-[color-mix(in_oklab,var(--color-destructive)_15%,transparent)] text-[var(--color-destructive)]",
              )}
            >
              {wow.pct === 0 ? "Sin cambio" : `${wow.improved ? "" : "+"}${wow.pct}% fallos`}
            </span>
          </div>
        ) : null}
      </div>

      {isLoading && !data ? (
        <Skeleton className="h-[260px] rounded-md" />
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <EtlTrendChart data={data} />
      )}
    </DashboardCardFrame>
  );
}

/* -------------------------------------------------------- 5. Estado DWH */

export function DwhStateCard() {
  const { data: health } = useSystemHealth();
  const { data, isLoading, isError, error, refetch } = useDwhState();
  const level = pickLevel(health, "dwh");

  return (
    <DashboardCardFrame
      title="Estado DWH"
      description="Catálogo de facts y actividad 24 h"
      href="/dwh"
      level={level}
    >
      {isLoading && !data ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Facts registradas"
              value={formatNumber(data.tables)}
              icon={<Database className="h-4 w-4" aria-hidden />}
            />
            <Stat
              label="Filas insertadas 24 h"
              value={formatNumber(data.rowsLast24h)}
            />
            <Stat
              label="Rechazadas 24 h"
              value={formatNumber(data.rejectedLast24h)}
              valueClass={
                data.rejectedLast24h > 0
                  ? "text-[var(--color-warning)]"
                  : undefined
              }
            />
            <Stat
              label="Fallos 24 h"
              value={formatNumber(data.failedLast24h)}
              valueClass={
                data.failedLast24h > 0
                  ? "text-[var(--color-destructive)]"
                  : undefined
              }
            />
            <div className="col-span-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <RefreshCw aria-hidden className="h-3 w-3" />
              {data.lastSuccessAt
                ? `Última corrida exitosa ${timeAgo(data.lastSuccessAt)}`
                : "Sin corridas exitosas registradas"}
            </div>
          </div>
          <DataFreshnessTable />
        </div>
      )}
    </DashboardCardFrame>
  );
}

function Stat({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          valueClass,
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* ----------------------------------------------------- 6. Calidad de datos */

export function QualitySummaryCard() {
  const { data: health } = useSystemHealth();
  const { data, isLoading, isError, error, refetch } = useQualityKpis();
  const level = pickLevel(health, "quality");

  return (
    <DashboardCardFrame
      title="Calidad — Cuarentena"
      description="Estado de los registros en MDM.Cuarentena"
      href="/quality"
      level={level}
    >
      {isLoading && !data ? (
        // V5: iso-layout — número grande + sub-line + donut 150px.
        <div className="flex flex-col gap-3" aria-busy="true">
          <div className="flex items-baseline gap-3">
            <Skeleton className="h-9 w-24 rounded" />
            <Skeleton className="h-3.5 w-40 rounded" />
          </div>
          <Skeleton className="h-[150px] rounded-md" />
        </div>
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.total === 0 ? (
        <EmptyState
          icon={<ShieldCheck aria-hidden className="h-5 w-5" />}
          tone="success"
          title="Cuarentena vacía"
          description="Los registros entran a cuarentena cuando fallan las reglas de validación de Silver."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <span
              className={cn(
                "text-4xl font-bold tabular-nums",
                data.resolutionRate >= 90
                  ? "text-[var(--color-success)]"
                  : data.resolutionRate >= 70
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-destructive)]",
              )}
            >
              {data.resolutionRate.toFixed(1)}%
            </span>
            <span className="text-sm text-[var(--color-text-muted)]">
              tasa de resolución sobre {formatNumber(data.total)} registros
            </span>
          </div>

          <QualityPieChart
            pendientes={data.pendientes}
            resueltos={data.resueltos}
            descartados={data.descartados}
          />
        </div>
      )}
    </DashboardCardFrame>
  );
}

/* --------------------------------------------------- Header-level helpers */

/**
 * Indicador V4: auto-refresh visible.
 *
 * Mientras `isFetching`, mostramos un Loader2 girando + "Actualizando…".
 * Cuando está idle, mostramos "Actualizado hace Ns" derivado de
 * `data.updatedAt`. Da sensación de vida sin ser intrusivo.
 *
 * No introduce un timer client-side — el cálculo de "hace Ns" se hace
 * en cada render, que ya ocurre cada vez que TanStack revalida.
 */
export function LastSyncBadge() {
  const { data, isFetching } = useSystemHealth();

  if (isFetching) {
    return (
      <span
        aria-live="polite"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"
      >
        <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
        Actualizando…
      </span>
    );
  }

  if (!data) return null;

  return (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"
    >
      <Activity aria-hidden className="h-3 w-3" />
      Actualizado {timeAgo(data.updatedAt)}
    </span>
  );
}

/**
 * Empty state V6 — reemplazo del EmptyHint plano.
 *
 * Diseño: icono tonal grande + título corto + descripción que enseña
 * la interfaz (qué dispara que aparezcan datos aquí) + opcional CTA.
 * Sin emojis. Tono `muted` por defecto; `success` cuando vacío = bien
 * (cuarentena, alertas).
 */
function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
  tone = "muted",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  tone?: "muted" | "success";
}) {
  const iconColor =
    tone === "success"
      ? "text-[var(--color-success)]"
      : "text-[var(--color-text-muted)]";
  return (
    <div className="flex flex-col items-start gap-2 py-2">
      <span aria-hidden className={cn("opacity-70", iconColor)}>
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
        <p className="max-w-prose text-xs text-[var(--color-text-muted)]">
          {description}
        </p>
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-2"
        >
          {actionLabel}
          <ArrowRight aria-hidden className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------- ETL Health Card */

const EtlHealthHeatmap = dynamic(
  () => import("./etl-health-heatmap").then((m) => m.EtlHealthHeatmap),
  { ssr: false, loading: () => <Skeleton className="h-36 rounded-md" /> },
);

export function EtlHealthCard() {
  return (
    <DashboardCardFrame
      title="Salud ETL — últimos 14 días"
      description="Un cuadrado por proceso y día (últimos 14 días): verde = éxito, rojo = fallo."
      href="/etl-monitor"
    >
      <EtlHealthHeatmap />
    </DashboardCardFrame>
  );
}
