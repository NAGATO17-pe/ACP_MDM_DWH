"use client";

/**
 * components/control-center/active-run-card.tsx
 * ==============================================
 * Card "en vivo" para una corrida ETL activa (queued/running).
 *
 * Renderiza:
 *   - Header con ID corto, modo, usuario, badge de estado y LiveHeartbeat.
 *   - Tiempo transcurrido desde startedAt (timer client-side, tick 1s).
 *   - Progreso pasos completados / total (Progress bar).
 *   - Pipeline horizontal con dots por paso (mini-vista del detail).
 *   - Acciones: "Ver detalle" y "Cancelar".
 *
 * Hace su propio `useCorridaDetail(id)` con polling 3s — es el componente
 * el que sabe que cuando está activo necesita info "viva", el padre solo
 * provee la lista (que viene de /api/cc/etl/active).
 */

import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { LiveHeartbeat } from "@/components/control-center/live-heartbeat";
import { useCorridaDetail, useCancelCorrida } from "@/hooks/use-control-center";
import { useTickingNow, formatElapsed } from "@/hooks/use-ticking-now";
import { cn } from "@/lib/utils";
import { toneFromCorrida } from "@/lib/status";
import type { CorridaActiva } from "@/lib/schemas/etl-launch";
import type { CorridaPaso, CorridaDetail } from "@/lib/schemas/control-center";

interface ActiveRunCardProps {
  corrida: CorridaActiva;
}

export function ActiveRunCard({ corrida }: ActiveRunCardProps) {
  const { data: detail, isLoading } = useCorridaDetail(corrida.id);
  const cancel = useCancelCorrida();
  const now = useTickingNow(1000);

  const status = mapCorridaStatus(detail?.status ?? corrida.estado);
  const tone = toneFromCorrida(status);
  const isCancellable = status === "running" || status === "queued";

  const startMs = corrida.fechaInicio
    ? Date.parse(corrida.fechaInicio)
    : detail?.startedAt
      ? Date.parse(detail.startedAt)
      : null;
  const elapsedSec =
    startMs && !Number.isNaN(startMs)
      ? Math.max(0, Math.floor((now - startMs) / 1000))
      : null;

  const pasos = detail?.pasos ?? [];
  const sortedPasos = [...pasos].sort((a, b) => a.orden - b.orden);
  const completados = sortedPasos.filter((p) => p.status === "success").length;
  const total = sortedPasos.length;
  const progressPct = total > 0 ? Math.round((completados / total) * 100) : 0;

  return (
    <article
      aria-label={`Corrida en curso ${shortId(corrida.id)}`}
      className={cn(
        "bg-surface flex flex-col gap-3 rounded-lg border border-[var(--color-border)] p-4 shadow-sm",
        "border-l-4",
        toneBorderLeft(status),
      )}
    >
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="font-mono text-sm font-semibold text-[var(--color-text)]"
              title={corrida.id}
            >
              {shortId(corrida.id)}
            </span>
            <StatusBadge
              tone={tone.tone}
              label={tone.label}
              icon={tone.icon}
              spin={tone.spin}
              variant="pill"
              size="sm"
            />
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {[
              corrida.iniciadoPor ?? detail?.startedBy,
              corrida.modoEjecucion ?? detail?.mode,
              corrida.facts.length === 1
                ? corrida.facts[0]
                : corrida.facts.length > 1
                  ? `${corrida.facts.length} facts`
                  : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <LiveHeartbeat
            lastHeartbeat={detail?.lastHeartbeat ?? null}
            isActive={isCancellable}
          />
          {elapsedSec != null ? (
            <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
              ⏱ {formatElapsed(elapsedSec)}
            </span>
          ) : null}
        </div>
      </header>

      {/* Progress */}
      {total > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">
              {completados} de {total} pasos completados
            </span>
            <span className="tabular-nums font-medium text-[var(--color-text-secondary)]">
              {progressPct}%
            </span>
          </div>
          <Progress value={progressPct} />
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
          Obteniendo estado del runner…
        </div>
      ) : (
        <p className="text-xs italic text-[var(--color-text-muted)]">
          {status === "queued"
            ? "Corrida en cola — el runner la tomará en breve"
            : status === "running"
              ? "Runner activo, publicando primer paso…"
              : "Sin pasos registrados aún"}
        </p>
      )}

      {/* Pipeline */}
      {sortedPasos.length > 0 ? (
        <PipelineStrip pasos={sortedPasos} />
      ) : null}

      {/* Actions */}
      <footer className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link
            href={`/etl-monitor/${corrida.id}`}
            aria-label={`Ver detalle de corrida ${shortId(corrida.id)}`}
          >
            Ver detalle
            <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        </Button>
        {isCancellable ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm("¿Cancelar esta corrida?")) {
                cancel.mutate({ id: corrida.id });
              }
            }}
            aria-label={`Cancelar corrida ${shortId(corrida.id)}`}
          >
            <XCircle aria-hidden className="h-3.5 w-3.5" />
            Cancelar
          </Button>
        ) : null}
      </footer>
    </article>
  );
}

/* -------------------------------------------------------------------------- */

function PipelineStrip({ pasos }: { pasos: CorridaPaso[] }) {
  return (
    <ol
      aria-label="Progreso del pipeline"
      className="flex flex-wrap items-center gap-1"
    >
      {pasos.map((p, idx) => (
        <li
          key={p.idPaso}
          className="flex items-center gap-1"
          title={`${p.nombre} — ${p.status}${p.durationSec != null ? ` · ${p.durationSec}s` : ""}`}
        >
          <span
            aria-label={`Paso ${idx + 1} ${p.nombre}: ${p.status}`}
            className={cn(
              "inline-block h-2 w-6 rounded-full transition-colors",
              pasoBg(p.status),
              p.status === "running" && "animate-pulse",
            )}
          />
          {idx < pasos.length - 1 ? (
            <span aria-hidden className="text-[var(--color-text-muted)] text-[10px]">
              ›
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function pasoBg(status: CorridaPaso["status"]): string {
  switch (status) {
    case "success":
      return "bg-[var(--color-success)]";
    case "running":
      return "bg-[var(--color-info)]";
    case "failed":
      return "bg-[var(--color-destructive)]";
    case "queued":
      return "bg-[var(--color-warning)]";
    case "canceled":
      return "bg-[var(--color-text-muted)]";
  }
}

function toneBorderLeft(status: CorridaDetail["status"]): string {
  switch (status) {
    case "running":
      return "border-l-[var(--color-info)]";
    case "queued":
      return "border-l-[var(--color-warning)]";
    case "failed":
      return "border-l-[var(--color-destructive)]";
    case "canceled":
      return "border-l-[var(--color-text-muted)]";
    case "success":
      return "border-l-[var(--color-success)]";
  }
}

/** Normaliza el estado libre del backend ("PENDIENTE", "RUNNING", etc.) a CorridaStatus. */
function mapCorridaStatus(
  raw: string | undefined,
): "running" | "queued" | "failed" | "canceled" | "success" {
  switch (raw?.toUpperCase()) {
    case "RUNNING":
    case "EN_PROCESO":
      return "running";
    case "PENDIENTE":
    case "QUEUED":
      return "queued";
    case "FAILED":
    case "ERROR":
    case "TIMEOUT":
      return "failed";
    case "CANCELED":
    case "CANCELADO":
      return "canceled";
    case "SUCCESS":
    case "OK":
      return "success";
    default:
      return "running";
  }
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}
