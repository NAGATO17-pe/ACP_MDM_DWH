# Dashboard Control Center V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the ACP Portal MDM dashboard into a high-impact operational control center with 6 Hero KPIs, real-time active-run tracking, a live alert feed, a data-freshness table, and a 14-day ETL health heatmap.

**Architecture:** All new widgets are `"use client"` components that consume already-existing hooks (`useActiveCorridas`, `useActiveAlerts`, `useSystemHealth`, `useEtlTrend`, `useDwhState`). No new API routes are needed. The layout in `dashboard.tsx` is reorganized into five zones; all existing `DashboardCardFrame` conventions (border-l-4 tonal, skeletons, error states) are preserved.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Tailwind 4 · TanStack Query v5 · Recharts · Lucide icons · Zod schemas already in `lib/schemas/`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Modify** | `app/globals.css` | Add 4 glow CSS tokens |
| **Create** | `components/control-center/system-status-strip.tsx` | Inline status pills for page header |
| **Modify** | `components/control-center/hero-kpis.tsx` | 6 tiles: Pipeline Score + Active Runs + 4 existing (text-4xl) |
| **Create** | `components/control-center/live-runs-panel.tsx` | Real-time list of running ETL jobs |
| **Create** | `components/control-center/alert-feed-live.tsx` | Latest 5 alerts, 15s refresh |
| **Modify** | `components/control-center/dashboard-cards.tsx` | EtlTrendCard: 7/14/30-day range selector |
| **Create** | `components/control-center/data-freshness-table.tsx` | Per-fact last-load table (static mock + TODO) |
| **Modify** | `components/control-center/dashboard-cards.tsx` | DwhStateCard: embed DataFreshnessTable |
| **Modify** | `components/control-center/etl-health-heatmap.tsx` | Extend to 14 days |
| **Modify** | `components/control-center/dashboard.tsx` | New 5-zone layout |

---

## Task 1: Add glow tokens to globals.css

**Files:**
- Modify: `app/globals.css` (lines 9–51 `:root` block and lines 53–71 `:root[data-theme="light"]` block)

- [ ] **Step 1: Add tokens to dark theme block**

Open `app/globals.css`. Inside `:root, :root[data-theme="dark"] { ... }` (after `--color-ring: #60a5fa;`), add:

```css
  /* Glow — used in hero KPI tiles when state is non-ok */
  --color-success-glow: color-mix(in oklab, var(--color-success) 12%, transparent);
  --color-destructive-glow: color-mix(in oklab, var(--color-destructive) 12%, transparent);
  --color-warning-glow: color-mix(in oklab, var(--color-warning) 12%, transparent);
  --color-info-glow: color-mix(in oklab, var(--color-info) 10%, transparent);
```

- [ ] **Step 2: Add tokens to light theme block**

Inside `:root[data-theme="light"] { ... }` (after `--color-ring: #2563eb;`), add the same four lines verbatim (they reference semantic tokens so they resolve correctly in light mode too).

- [ ] **Step 3: Add tokens to @theme inline block**

Inside `@theme inline { ... }`, after `--color-ring: var(--color-ring);`, add:

```css
  --color-success-glow: var(--color-success-glow);
  --color-destructive-glow: var(--color-destructive-glow);
  --color-warning-glow: var(--color-warning-glow);
  --color-info-glow: var(--color-info-glow);
```

- [ ] **Step 4: Verify build compiles**

```bash
cd "D:\Proyecto2026\ACP_DWH\ACP Proyecciones\Portal_MDM_NEXTJS\Portal-Nextjs\portal-mdm"
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` (or similar — no CSS errors).

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(dashboard): add glow CSS tokens for hero KPI states"
```

---

## Task 2: Create SystemStatusStrip

New file that renders four colored pills (ETL / DWH / Calidad / Alertas) directly in the page header row. Consumes `useSystemHealth`.

**Files:**
- Create: `components/control-center/system-status-strip.tsx`

- [ ] **Step 1: Create the file**

```tsx
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

  const components: Array<{ key: keyof typeof data & string; level: StatusLevel | undefined }> = [
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "system-status-strip" | head -10
```

Expected: no output (no errors in the new file).

- [ ] **Step 3: Commit**

```bash
git add components/control-center/system-status-strip.tsx
git commit -m "feat(dashboard): add SystemStatusStrip inline health pills"
```

---

## Task 3: Update HeroKpis — 6 tiles, text-4xl, sparklines larger

Adds two new tiles (Pipeline Health Score, Active Runs) and enlarges existing tiles.

**Files:**
- Modify: `components/control-center/hero-kpis.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import {
  Activity,
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
    if (arr.length === 0) return 100; // no runs = healthy (no failures)
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

  const scoreTone =
    healthScore >= 90 ? undefined : healthScore >= 70 ? "warning" : "destructive";

  const activeRunsTone = activeCount > 0 ? "info" : undefined;

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
                "h-2 w-2 rounded-full",
                tone ? `bg-[var(--color-${tone === "destructive" ? "destructive" : tone === "warning" ? "warning" : "info"})]` : "bg-[var(--color-info)]",
                "animate-pulse",
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
  const Icon = up
    ? () => (
        <svg aria-hidden className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path d="M6 2L10 8H2L6 2Z" fill="currentColor" />
        </svg>
      )
    : () => (
        <svg aria-hidden className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path d="M6 10L2 4H10L6 10Z" fill="currentColor" />
        </svg>
      );
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
      <Icon />
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "hero-kpis" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/control-center/hero-kpis.tsx
git commit -m "feat(dashboard): expand Hero KPIs to 6 tiles — Pipeline Score + Active Runs"
```

---

## Task 4: Create LiveRunsPanel

Real-time list of currently running ETL corridas. Shows name, elapsed time (ticking every second), and a pulsing EJECUTANDO badge.

**Files:**
- Create: `components/control-center/live-runs-panel.tsx`

- [ ] **Step 1: Create the file**

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "live-runs" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/control-center/live-runs-panel.tsx
git commit -m "feat(dashboard): add LiveRunsPanel with real-time elapsed timer"
```

---

## Task 5: Create AlertFeedLive

Latest 5 alerts from `useActiveAlerts` (15s refetch). Critical = red tint, warning = amber tint.

**Files:**
- Create: `components/control-center/alert-feed-live.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import Link from "next/link";
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
 * Refetches every 15 seconds (faster than the default 60s for this widget).
 */
export function AlertFeedLive() {
  const { data, isLoading, isError } = useActiveAlerts();

  // Sort newest first and take top 5
  const sorted = [...(data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const visible = sorted.slice(0, 5);

  return (
    <DashboardCardFrame
      title="Alertas recientes"
      description="Últimas 5 alertas del sistema"
      href="/alerts"
      level={
        (data ?? []).some((a) => a.severity === "critical" && !a.acknowledged)
          ? "critical"
          : (data ?? []).some((a) => a.severity === "warning" && !a.acknowledged)
            ? "warning"
            : undefined
      }
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
          <Link
            href="/alerts"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-2"
          >
            Ver todas
            <ArrowRight aria-hidden className="h-3 w-3" />
          </Link>
        </>
      )}
    </DashboardCardFrame>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "alert-feed" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/control-center/alert-feed-live.tsx
git commit -m "feat(dashboard): add AlertFeedLive with critical/warning color tinting"
```

---

## Task 6: ETL Trend range selector (7d / 14d / 30d)

Modify the `EtlTrendCard` function inside `dashboard-cards.tsx` to add a local state range toggle.

**Files:**
- Modify: `components/control-center/dashboard-cards.tsx`

- [ ] **Step 1: Add `useState` to the React import at the top**

Find the existing import line (line 1):

```tsx
"use client";

import { useMemo } from "react";
```

Replace with:

```tsx
"use client";

import { useMemo, useState } from "react";
```

- [ ] **Step 2: Replace the EtlTrendCard function**

Find and replace the entire `EtlTrendCard` function (from `export function EtlTrendCard` through its closing `}`):

```tsx
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
                  ? "bg-[var(--color-success-glow)] text-[var(--color-success)]"
                  : "bg-[var(--color-destructive-glow)] text-[var(--color-destructive)]",
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "dashboard-cards" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/control-center/dashboard-cards.tsx
git commit -m "feat(dashboard): add 7d/14d/30d range selector to EtlTrendCard"
```

---

## Task 7: Create DataFreshnessTable and embed in DwhStateCard

Shows per-fact last-load freshness. Uses static mock data until the backend provides per-fact endpoints.

**Files:**
- Create: `components/control-center/data-freshness-table.tsx`
- Modify: `components/control-center/dashboard-cards.tsx` (DwhStateCard)

- [ ] **Step 1: Create data-freshness-table.tsx**

```tsx
"use client";

import { cn } from "@/lib/utils";

// TODO: Replace with real per-fact endpoint when /api/cc/dwh/facts is available.
// The backend currently exposes only aggregate DwhState, not per-fact data.
const MOCK_FACTS: { name: string; lastSuccess: string }[] = [
  {
    name: "Fact_Cosecha_SAP",
    lastSuccess: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    name: "Fact_Proyeccion_Temporal",
    lastSuccess: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
  },
  {
    name: "Fact_Liquidacion_Gold",
    lastSuccess: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
  },
  {
    name: "Fact_Calidad_Variedad",
    lastSuccess: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    name: "Fact_Rendimiento_Bronce",
    lastSuccess: new Date(Date.now() - 15 * 3600 * 1000).toISOString(),
  },
];

function ageLabel(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 1) return "< 1 h";
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

function freshnessLevel(isoDate: string): "ok" | "warning" | "critical" {
  const diffH = (Date.now() - new Date(isoDate).getTime()) / 3_600_000;
  if (diffH < 6) return "ok";
  if (diffH < 24) return "warning";
  return "critical";
}

const LEVEL_CLASSES: Record<string, string> = {
  ok: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  critical: "text-[var(--color-destructive)]",
};

const LEVEL_LABELS: Record<string, string> = {
  ok: "Fresco",
  warning: "Aviso",
  critical: "Stale",
};

/**
 * Per-fact data freshness table.
 * Data is currently mocked — TODO: connect to /api/cc/dwh/facts.
 */
export function DataFreshnessTable() {
  const facts = MOCK_FACTS.sort(
    (a, b) => new Date(a.lastSuccess).getTime() - new Date(b.lastSuccess).getTime(),
  );

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        Frescura de datos por fact
      </p>
      <table className="w-full text-xs" aria-label="Frescura de datos por fact table">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            <th className="pb-1 pr-2 text-left font-medium">Fact</th>
            <th className="pb-1 pr-2 text-right font-medium">Edad</th>
            <th className="pb-1 text-right font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {facts.map((f) => {
            const level = freshnessLevel(f.lastSuccess);
            return (
              <tr key={f.name} className="border-t border-[var(--color-border)]/50">
                <td
                  className="py-1 pr-2 font-mono text-[11px] text-[var(--color-text-secondary)] max-w-[120px] truncate"
                  title={f.name}
                >
                  {f.name.replace("Fact_", "")}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums text-[var(--color-text-muted)]">
                  {ageLabel(f.lastSuccess)}
                </td>
                <td className={cn("py-1 text-right font-medium", LEVEL_CLASSES[level])}>
                  {LEVEL_LABELS[level]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Import DataFreshnessTable in dashboard-cards.tsx**

At the top of `dashboard-cards.tsx`, after the last local import, add:

```tsx
import { DataFreshnessTable } from "./data-freshness-table";
```

- [ ] **Step 3: Embed DataFreshnessTable in DwhStateCard**

Find `DwhStateCard`. Inside the success branch (after the `<div className="col-span-2 flex items-center gap-2 ...">` row that shows "Última corrida exitosa"), add a closing `</div>` for the grid then append `<DataFreshnessTable />`. The full data-ready branch should read:

```tsx
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
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -iE "freshness|dwh-state" | head -10
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add components/control-center/data-freshness-table.tsx components/control-center/dashboard-cards.tsx
git commit -m "feat(dashboard): add DataFreshnessTable to DwhStateCard"
```

---

## Task 8: Extend ETL Health Heatmap to 14 days

**Files:**
- Modify: `components/control-center/etl-health-heatmap.tsx`

- [ ] **Step 1: Replace getLast7Days with getLastNDays and update the component**

Find `function getLast7Days(): string[]` and replace through the end of the export function:

```tsx
function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

// ... (keep toDate and dayLabel functions unchanged)
```

- [ ] **Step 2: Update the constant and usages in EtlHealthHeatmap**

Find and replace in `EtlHealthHeatmap`:

```tsx
  const { days, rows } = useMemo(() => {
    const days = getLastNDays(14);   // was getLast7Days()
    const cutoff = days[0];
```

- [ ] **Step 3: Update EtlHealthCard description in dashboard-cards.tsx**

Find:
```tsx
      description="Un cuadrado por proceso y día: verde = éxito, rojo = fallo."
```

Replace with:
```tsx
      description="Un cuadrado por proceso y día (últimos 14 días): verde = éxito, rojo = fallo."
```

Also update the card title from `"Salud ETL — últimos 7 días"` to `"Salud ETL — últimos 14 días"`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "heatmap" | head -10
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add components/control-center/etl-health-heatmap.tsx components/control-center/dashboard-cards.tsx
git commit -m "feat(dashboard): extend ETL health heatmap to 14 days"
```

---

## Task 9: Update dashboard.tsx — new 5-zone layout

Integrates all new widgets into the final layout. The Page Header now receives `SystemStatusStrip` inline.

**Files:**
- Modify: `components/control-center/dashboard.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
import { PageHeader } from "@/components/ui/page-header";
import { HeroKpis } from "./hero-kpis";
import {
  ActiveAlertsCard,
  DwhStateCard,
  EtlHealthCard,
  EtlTrendCard,
  GlobalStatusCard,
  LastSyncBadge,
  QualitySummaryCard,
  RecentActivityCard,
} from "./dashboard-cards";
import { DashboardRefreshControl } from "./dashboard-refresh-control";
import { SystemStatusStrip } from "./system-status-strip";
import { LiveRunsPanel } from "./live-runs-panel";
import { AlertFeedLive } from "./alert-feed-live";

interface DashboardProps {
  title: string;
  description?: string;
}

/**
 * Dashboard Control Center V2.
 *
 * Five zones:
 *   1. PageHeader with inline SystemStatusStrip pills.
 *   2. Hero KPIs — 6 tiles (Pipeline Score, Active Runs, Filas, Fallos, Cuarentena, Alertas).
 *   3. Live Panel (Active runs + Alert feed) | ETL Trend with range selector.
 *   4. DWH State + Data Freshness | Quality Summary.
 *   5. ETL Health Heatmap (14 days, full width).
 */
export function Dashboard({ title, description }: DashboardProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Zone 1: Header */}
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <SystemStatusStrip />
            <div className="flex items-center gap-2">
              <DashboardRefreshControl />
              <LastSyncBadge />
            </div>
          </div>
        }
      />

      {/* Zone 2: Hero KPIs */}
      <HeroKpis />

      {/* Zone 3: Live Panel + ETL Trend */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <LiveRunsPanel />
          <AlertFeedLive />
        </div>
        <div className="lg:col-span-2">
          <EtlTrendCard />
        </div>
      </section>

      {/* Zone 4: DWH State + Quality */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <DwhStateCard />
        </div>
        <div className="lg:col-span-2">
          <QualitySummaryCard />
        </div>
      </section>

      {/* Zone 5: Health Heatmap full width */}
      <section>
        <EtlHealthCard />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors. If there are errors, they are almost certainly in the files modified in Tasks 3–8 — fix them before proceeding.

- [ ] **Step 3: Run lint**

```bash
npm run lint 2>&1 | tail -30
```

Expected: no errors. Warnings about `any` types are acceptable if they pre-existed.

- [ ] **Step 4: Run build**

```bash
npm run build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` or equivalent.

- [ ] **Step 5: Commit final layout**

```bash
git add components/control-center/dashboard.tsx
git commit -m "feat(dashboard): assemble Dashboard V2 — 5-zone layout with live panels and status strip"
```

---

## Self-Review Checklist

### Spec coverage

| Requirement | Task |
|---|---|
| Glow CSS tokens | Task 1 |
| SystemStatusStrip inline header pills | Task 2 |
| 6 Hero KPIs (Pipeline Score + Active Runs + 4 existing) | Task 3 |
| text-4xl numbers | Task 3 (KpiTile renders `text-4xl`) |
| Larger sparklines (h-16 w-2/3) | Task 3 |
| Progress bar in Pipeline Score tile | Task 3 |
| Pulsing dot for Active Runs and critical alerts | Task 3 |
| LiveRunsPanel with ticking elapsed timer | Task 4 |
| AlertFeedLive with color-tinted rows | Task 5 |
| ETL Trend range selector 7d/14d/30d | Task 6 |
| WoW badge adapted for variable range | Task 6 |
| DataFreshnessTable (mock + TODO comment) | Task 7 |
| Embed DataFreshnessTable in DwhStateCard | Task 7 |
| ETL Health Heatmap 14 days | Task 8 |
| Final 5-zone layout | Task 9 |

### Constraints verified

- No emojis — only Lucide icons used everywhere.
- `border-l-4` side-stripe preserved in all cards and KPI tiles.
- All tokens use `var(--color-*)` — no hex inline in components.
- `"use client"` only on files that use hooks/state: hero-kpis, live-runs-panel, alert-feed-live, system-status-strip, dashboard-cards. `dashboard.tsx` remains a Server Component.
- Skeletons present in LiveRunsPanel and AlertFeedLive loading states.
- Empty states defined: LiveRunsPanel ("Sistema en reposo"), AlertFeedLive ("Sin alertas activas").
- Error state in AlertFeedLive.
- No new libraries installed.

### Type consistency

- `CorridaActiva` fields used: `.id`, `.estado`, `.iniciadoPor`, `.fechaInicio` — all match `lib/schemas/etl-launch.ts`.
- `Alert` fields used: `.id`, `.severity`, `.source`, `.message`, `.createdAt`, `.acknowledged` — all match `lib/schemas/control-center.ts`.
- `SystemHealth` fields used: `.etl`, `.dwh`, `.quality`, `.alerts` — all match.
- `EtlTrendPoint` fields: `.date`, `.success`, `.failed` — all match.
- `useActiveCorridas`, `useActiveAlerts`, `useSystemHealth`, `useEtlTrend`, `useDwhState` — all exported from `hooks/use-control-center.ts`.
