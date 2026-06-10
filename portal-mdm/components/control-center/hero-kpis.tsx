"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertOctagon,
  Database,
  GaugeCircle,
  ShieldAlert,
  ShieldQuestion,
  XCircle,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { RECHARTS_THEME } from "@/components/charts/recharts-theme";
import {
  useActiveCorridas,
  useActiveAlerts,
  useDwhState,
  useEtlTrend,
  useQualityKpis,
} from "@/hooks/use-control-center";

// Recharts outside initial bundle: KPI numbers appear immediately.
const KpiSparkline = dynamic(
  () => import("./kpi-sparkline").then((m) => m.KpiSparkline),
  { ssr: false, loading: () => null },
);

/**
 * Hero KPI row — 6 tiles.
 *
 * Tile 1: Pipeline Health Score (0–100 composite from today's ETL runs).
 * Tile 2: Active runs right now (real-time via useActiveCorridas 5s poll).
 * Tiles 3–6: Filas 24h · Fallos ETL · Cuarentena · Alertas críticas.
 */
export function HeroKpis() {
  const trend = useEtlTrend(14);
  const trendToday = useEtlTrend(1);
  const dwh = useDwhState();
  const quality = useQualityKpis();
  const alerts = useActiveAlerts();
  const activeCorridas = useActiveCorridas();

  // ── Pipeline Health Score ────────────────────────────────────────────────
  const healthScore = useMemo(() => {
    const arr = trendToday.data ?? [];
    if (arr.length === 0) return 100;
    const today = arr[arr.length - 1];
    const total = (today?.success ?? 0) + (today?.failed ?? 0);
    if (total === 0) return 100;
    return Math.round(((today?.success ?? 0) / total) * 100);
  }, [trendToday.data]);

  // ── Fallos 24h delta ────────────────────────────────────────────────────
  const fallosInfo = useMemo(() => {
    const arr = trend.data ?? [];
    if (arr.length === 0) return null;
    const hoy = arr[arr.length - 1]?.failed ?? 0;
    const ayer = arr.length >= 2 ? (arr[arr.length - 2]?.failed ?? 0) : null;
    return { hoy, ayer };
  }, [trend.data]);

  // ── Active corridas count ───────────────────────────────────────────────
  const activeCount = (activeCorridas.data ?? []).length;

  // ── Critical alerts (48h, not acknowledged) ────────────────────────────
  const criticalCount = useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return (alerts.data ?? []).filter(
      (a) =>
        a.severity === "critical" &&
        !a.acknowledged &&
        new Date(a.createdAt).getTime() > cutoff,
    ).length;
  }, [alerts.data]);

  const scoreTone: Tone | undefined =
    healthScore >= 90 ? undefined : healthScore >= 70 ? "warning" : "destructive";

  const activeRunsTone: Tone | undefined = activeCount > 0 ? "info" : undefined;

  return (
    <section
      aria-label="Indicadores clave"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
    >
      {/* Tile 1: Pipeline Health Score */}
      <KpiTile
        href="/etl-monitor"
        label="SALUD PIPELINE"
        loading={trendToday.isLoading && !trendToday.data}
        icon={<GaugeCircle aria-hidden className="h-4 w-4" />}
        iconTone={scoreTone ?? "success"}
        value={`${healthScore}`}
        valueSuffix="/100"
        tone={scoreTone}
        progressBar={{ value: healthScore, max: 100 }}
      />

      {/* Tile 2: Active runs */}
      <KpiTile
        href="/etl-monitor"
        label="EN EJECUCIÓN"
        loading={activeCorridas.isLoading && !activeCorridas.data}
        icon={<Zap aria-hidden className="h-4 w-4" />}
        iconTone={activeRunsTone ?? "success"}
        value={formatNumber(activeCount)}
        tone={activeRunsTone}
        pulseDot={activeCount > 0}
      />

      {/* Tile 3: Filas 24h */}
      <KpiTile
        href="/dwh"
        label="FILAS INSERTADAS 24 H"
        loading={dwh.isLoading && !dwh.data}
        icon={<Database aria-hidden className="h-4 w-4" />}
        iconTone="info"
        value={dwh.data ? formatNumber(dwh.data.rowsLast24h) : "—"}
        sparkline={trend.data?.map((p) => ({ value: p.success })) ?? []}
        sparklineColor={RECHARTS_THEME.success}
      />

      {/* Tile 4: Fallos ETL 24h */}
      <KpiTile
        href="/etl-monitor"
        label="FALLOS ETL 24 H"
        loading={trend.isLoading && !trend.data}
        icon={<XCircle aria-hidden className="h-4 w-4" />}
        iconTone={
          (fallosInfo?.hoy ?? 0) >= 3
            ? "destructive"
            : (fallosInfo?.hoy ?? 0) >= 1
              ? "warning"
              : "success"
        }
        value={formatNumber(fallosInfo?.hoy ?? 0)}
        tone={
          (fallosInfo?.hoy ?? 0) >= 3
            ? "destructive"
            : (fallosInfo?.hoy ?? 0) >= 1
              ? "warning"
              : undefined
        }
        delta={
          fallosInfo?.ayer != null
            ? deltaFromCounts(fallosInfo.hoy, fallosInfo.ayer)
            : undefined
        }
        sparkline={trend.data?.map((p) => ({ value: p.failed })) ?? []}
        sparklineColor={RECHARTS_THEME.destructive}
      />

      {/* Tile 5: Pendientes cuarentena */}
      <KpiTile
        href="/quality"
        label="PENDIENTES CUARENTENA"
        loading={quality.isLoading && !quality.data}
        icon={<ShieldQuestion aria-hidden className="h-4 w-4" />}
        iconTone={
          (quality.data?.pendientes ?? 0) > 20
            ? "destructive"
            : (quality.data?.pendientes ?? 0) > 0
              ? "warning"
              : "success"
        }
        value={formatNumber(quality.data?.pendientes ?? 0)}
        tone={
          (quality.data?.pendientes ?? 0) > 20
            ? "destructive"
            : (quality.data?.pendientes ?? 0) > 0
              ? "warning"
              : undefined
        }
      />

      {/* Tile 6: Alertas críticas */}
      <KpiTile
        href="/alerts"
        label="CRÍTICAS SIN ATENDER"
        loading={alerts.isLoading && !alerts.data}
        icon={
          criticalCount > 0 ? (
            <AlertOctagon aria-hidden className="h-4 w-4" />
          ) : (
            <ShieldAlert aria-hidden className="h-4 w-4" />
          )
        }
        iconTone={criticalCount > 0 ? "destructive" : "success"}
        value={formatNumber(criticalCount)}
        tone={criticalCount > 0 ? "destructive" : undefined}
        pulseDot={criticalCount > 0}
      />
    </section>
  );
}

/* ----------------------------------------------------------------- KpiTile */

type Tone = "destructive" | "warning" | "success" | "info";

function KpiTile({
  href,
  label,
  value,
  valueSuffix,
  loading,
  icon,
  iconTone,
  tone,
  delta,
  sparkline,
  sparklineColor,
  progressBar,
  pulseDot,
}: {
  href: string;
  label: string;
  value: string;
  valueSuffix?: string;
  loading: boolean;
  icon: React.ReactNode;
  iconTone: Tone;
  tone?: Tone;
  delta?: { pct: number; up: boolean; label: string };
  sparkline?: { value: number }[];
  sparklineColor?: string;
  progressBar?: { value: number; max: number };
  pulseDot?: boolean;
}) {
  const borderTone = tone ? toneBorderClass(tone) : "border-[var(--color-border)]";
  const bgGlow = tone ? toneGlowClass(tone) : "";

  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}${valueSuffix ?? ""}. Abrir detalle.`}
      className={cn(
        "group relative flex min-h-[120px] flex-col justify-between overflow-hidden rounded-lg border bg-[var(--color-surface)] p-4 transition",
        "border-l-4",
        borderTone,
        bgGlow,
        "hover:border-[var(--color-text-muted)] hover:shadow-md hover:bg-[var(--color-surface-2)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <span
          aria-hidden
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md",
            toneBgClass(iconTone),
            toneTextClass(iconTone),
          )}
        >
          {icon}
        </span>
        <div className="flex items-center gap-1.5">
          {pulseDot ? (
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 rounded-full animate-pulse",
                tone === "destructive"
                  ? "bg-[var(--color-destructive)]"
                  : tone === "warning"
                    ? "bg-[var(--color-warning)]"
                    : "bg-[var(--color-info)]",
              )}
            />
          ) : null}
          {delta ? (
            <DeltaChip pct={delta.pct} up={delta.up} label={delta.label} />
          ) : null}
        </div>
      </header>

      {loading ? (
        <Skeleton className="h-10 w-28 rounded" />
      ) : (
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              "text-4xl font-semibold tabular-nums leading-none",
              tone ? toneTextClass(tone) : "text-[var(--color-text)]",
            )}
          >
            {value}
          </span>
          {valueSuffix ? (
            <span className="text-lg font-normal text-[var(--color-text-muted)]">
              {valueSuffix}
            </span>
          ) : null}
        </div>
      )}

      <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {label}
      </p>

      {progressBar && !loading ? (
        <div
          aria-hidden
          className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              tone === "destructive"
                ? "bg-[var(--color-destructive)]"
                : tone === "warning"
                  ? "bg-[var(--color-warning)]"
                  : "bg-[var(--color-success)]",
            )}
            style={{ width: `${Math.min(100, Math.max(0, progressBar.value))}%` }}
          />
        </div>
      ) : null}

      {sparkline && sparkline.length >= 2 && sparklineColor ? (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-16 w-2/3 opacity-40 transition-opacity group-hover:opacity-70"
        >
          <KpiSparkline
            data={sparkline}
            color={sparklineColor}
            gradientId={`spark-${label}`}
          />
        </div>
      ) : null}
    </Link>
  );
}

function DeltaChip({ pct, up, label }: { pct: number; up: boolean; label: string }) {
  const bad = up && pct !== 0;
  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        bad
          ? "bg-[var(--color-destructive-glow)] text-[var(--color-destructive)]"
          : pct === 0
            ? "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
            : "bg-[var(--color-success-glow)] text-[var(--color-success)]",
      )}
    >
      {up ? "▲" : "▼"}
      {pct === 0 ? "=" : `${Math.abs(pct)}%`}
    </span>
  );
}

function toneTextClass(t: Tone): string {
  switch (t) {
    case "destructive": return "text-[var(--color-destructive)]";
    case "warning":     return "text-[var(--color-warning)]";
    case "success":     return "text-[var(--color-success)]";
    case "info":        return "text-[var(--color-info)]";
  }
}

function toneBgClass(t: Tone): string {
  switch (t) {
    case "destructive": return "bg-[var(--color-destructive-glow)]";
    case "warning":     return "bg-[var(--color-warning-glow)]";
    case "success":     return "bg-[var(--color-success-glow)]";
    case "info":        return "bg-[var(--color-info-glow)]";
  }
}

function toneGlowClass(t: Tone): string {
  switch (t) {
    case "destructive": return "bg-[color-mix(in_oklab,var(--color-destructive-glow)_50%,var(--color-surface))]";
    case "warning":     return "bg-[color-mix(in_oklab,var(--color-warning-glow)_50%,var(--color-surface))]";
    default:            return "";
  }
}

function toneBorderClass(t: Tone): string {
  switch (t) {
    case "destructive": return "border-[var(--color-border)] border-l-[var(--color-destructive)]";
    case "warning":     return "border-[var(--color-border)] border-l-[var(--color-warning)]";
    case "success":     return "border-[var(--color-border)] border-l-[var(--color-success)]";
    case "info":        return "border-[var(--color-border)] border-l-[var(--color-info)]";
  }
}

function deltaFromCounts(hoy: number, ayer: number) {
  if (ayer === 0 && hoy === 0) return { pct: 0, up: false, label: "Igual que ayer" };
  if (ayer === 0) return { pct: 100, up: hoy > 0, label: `Ayer no hubo fallos · hoy ${hoy}` };
  const pct = Math.round(((hoy - ayer) / ayer) * 100);
  return { pct, up: pct > 0, label: `Ayer ${ayer} · hoy ${hoy}` };
}
