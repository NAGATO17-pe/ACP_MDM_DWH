"use client";

/**
 * components/control-center/dwh-fact-panel.tsx
 * =============================================
 * Panel docked (no drawer) que muestra el detalle de un nodo del DWH.
 * Vive DENTRO del grid de la página — el lineage permanece visible
 * mientras inspeccionas. En mobile cae a stack debajo del mapa.
 *
 * Reemplaza visualmente al antiguo `DwhFactDrawer`. Las sub-vistas
 * (Metric, Section, TableList) se mantienen como puramente presentacionales.
 */

import Link from "next/link";
import {
  ArrowRight,
  Database,
  GitBranch,
  HelpCircle,
  Layers,
  Pin,
  PinOff,
  PlayCircle,
  Split,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { DwhNode, FactSummary, TableStatus } from "@/lib/schemas/dwh";
import type { Tone } from "@/lib/status";

interface DwhFactPanelProps {
  node: DwhNode;
  fact: FactSummary | null;
  onClose: () => void;
  pinned?: boolean;
  onTogglePin?: () => void;
  onExplain?: () => void;
  onCompare?: () => void;
  className?: string;
}

const LAYER_LABEL = {
  bronce: "Bronce",
  silver: "Silver",
  gold: "Gold",
} as const;

const STATUS_TONE: Record<TableStatus, Tone> = {
  ok: "ok",
  warning: "warning",
  failed: "critical",
  stale: "neutral",
  unknown: "neutral",
};

export function DwhFactPanel({
  node,
  fact,
  onClose,
  pinned = false,
  onTogglePin,
  onExplain,
  onCompare,
  className,
}: DwhFactPanelProps) {
  return (
    <aside
      aria-label={`Detalle de ${node.fullName}`}
      className={cn(
        "bg-surface flex h-full min-h-0 flex-col rounded-lg border border-[var(--color-border)] shadow-sm",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{LAYER_LABEL[node.layer]}</Badge>
            <StatusBadge
              tone={STATUS_TONE[node.status]}
              label={node.status.toUpperCase()}
              variant="pill"
              size="sm"
            />
          </div>
          <h2
            className="break-all font-mono text-sm font-semibold text-[var(--color-text)]"
            title={node.fullName}
          >
            {node.fullName}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {node.rowsLast24h > 0
              ? `${formatNumber(node.rowsLast24h)} filas en últimas 24 h`
              : "Sin actividad en últimas 24 h"}
          </p>
        </div>
        <div className="flex items-start gap-1">
          {onTogglePin ? (
            <button
              type="button"
              aria-label={pinned ? "Quitar de fijados" : "Fijar nodo"}
              aria-pressed={pinned}
              title={pinned ? "Desfijar" : "Fijar este nodo"}
              onClick={onTogglePin}
              className={cn(
                "rounded-sm p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                pinned
                  ? "bg-[color-mix(in_oklab,var(--color-primary)_14%,transparent)] text-[var(--color-primary)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
              )}
            >
              {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Cerrar panel"
            onClick={onClose}
            className="rounded-sm p-1 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <section aria-label="Métricas" className="grid grid-cols-2 gap-2">
          <Metric label="Filas 24 h" value={formatNumber(node.rowsLast24h)} />
          <Metric
            label="Rechazadas 24 h"
            value={formatNumber(node.rejectedLast24h)}
            tone={node.rejectedLast24h > 0 ? "warning" : "default"}
          />
          <Metric
            label="Última carga"
            value={node.lastLoadAt ? formatDateTime(node.lastLoadAt) : "—"}
            wide
          />
        </section>

        {fact ? <FactDetail fact={fact} /> : <NonFactDetail node={node} />}

        {/* Acciones secundarias (siempre disponibles cuando el host las pasa). */}
        {(onExplain || onCompare) && node.status !== "ok" ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {onExplain ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onExplain}
                aria-label="¿Por qué este nodo está así?"
              >
                <HelpCircle aria-hidden className="h-4 w-4" />
                ¿Por qué está así?
              </Button>
            ) : null}
            {onCompare ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCompare}
                aria-label="Comparar con otro nodo"
                title="Shift+click otro nodo para comparar"
              >
                <Split aria-hidden className="h-4 w-4" />
                Comparar…
              </Button>
            ) : null}
          </div>
        ) : null}

        {fact ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button asChild variant="primary" size="sm" onClick={onClose}>
              <Link
                href={`/etl-monitor/lanzar?fact=${encodeURIComponent(fact.nombre)}`}
              >
                <PlayCircle aria-hidden className="h-4 w-4" />
                Re-procesar
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" onClick={onClose}>
              <Link href="/etl-monitor">
                Ver corridas
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

/* ── Sub-views ───────────────────────────────────────────────────────────── */

function FactDetail({ fact }: { fact: FactSummary }) {
  return (
    <>
      <Section title="Estrategia de rerun">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {fact.estrategiaRerun}
        </p>
      </Section>

      <Section title="Fuentes Bronce" icon={<Database className="h-3.5 w-3.5" />}>
        {fact.fuentesBronce.length === 0 ? (
          <Empty>No declara fuentes Bronce</Empty>
        ) : (
          <TableList items={fact.fuentesBronce} />
        )}
      </Section>

      {fact.dependencias.length > 0 ? (
        <Section
          title="Dependencias de facts"
          icon={<GitBranch className="h-3.5 w-3.5" />}
        >
          <TableList items={fact.dependencias} />
        </Section>
      ) : null}

      <Section title="Marts Gold" icon={<Layers className="h-3.5 w-3.5" />}>
        {fact.marts.length === 0 ? (
          <Empty>No genera marts Gold</Empty>
        ) : (
          <TableList items={fact.marts} />
        )}
      </Section>
    </>
  );
}

function NonFactDetail({ node }: { node: DwhNode }) {
  return (
    <Section
      title={
        node.layer === "bronce"
          ? "Facts que consumen esta tabla"
          : "Facts que alimentan este mart"
      }
      icon={
        node.layer === "bronce" ? (
          <Database className="h-3.5 w-3.5" />
        ) : (
          <Layers className="h-3.5 w-3.5" />
        )
      }
    >
      {node.facts.length === 0 ? (
        <Empty>Sin facts asociados</Empty>
      ) : (
        <TableList items={node.facts} />
      )}
    </Section>
  );
}

interface MetricProps {
  label: string;
  value: string;
  tone?: "default" | "warning";
  wide?: boolean;
}

function Metric({ label, value, tone = "default", wide }: MetricProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5",
        wide && "col-span-2",
      )}
    >
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums text-sm font-semibold",
          tone === "warning"
            ? "text-[var(--color-warning)]"
            : "text-[var(--color-text)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="mt-4 flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
        {icon ? <span aria-hidden>{icon}</span> : null}
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function TableList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it) => (
        <li
          key={it}
          className="break-all rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 font-mono text-xs text-[var(--color-text-secondary)]"
          title={it}
        >
          {it}
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-dashed border-[var(--color-border)] px-3 py-2 text-xs italic text-[var(--color-text-muted)]">
      {children}
    </p>
  );
}
