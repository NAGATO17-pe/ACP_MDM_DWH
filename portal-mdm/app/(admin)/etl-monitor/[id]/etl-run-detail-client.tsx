"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EtlStatusBadge } from "@/components/control-center/etl-status-badge";
import { EtlExecutionLog } from "@/components/control-center/etl-execution-log";
import { LiveHeartbeat } from "@/components/control-center/live-heartbeat";
import {
  useCancelCorrida,
  useCorridaDetail,
} from "@/hooks/use-control-center";
import type { CorridaPaso } from "@/lib/schemas/control-center";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function EtlRunDetailClient({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useCorridaDetail(id);
  const cancel = useCancelCorrida();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState("");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 rounded-md" />
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-40 rounded-md" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-2 rounded-md border border-[var(--color-destructive)]/40 bg-[var(--color-surface-2)] p-4 text-sm"
      >
        <div className="flex items-center gap-2 text-[var(--color-destructive)]">
          <AlertTriangle aria-hidden className="h-4 w-4" />
          <span className="font-medium">No se pudo cargar la corrida</span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          {error instanceof Error ? error.message : "Backend no disponible."}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw aria-hidden className="h-3.5 w-3.5" />
          Reintentar
        </Button>
      </div>
    );
  }

  const isActive = data.status === "running" || data.status === "queued";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Corrida ${shortId(data.id)}`}
        description={`Iniciada por ${data.startedBy} · modo ${data.mode}${data.facts.length ? ` · ${data.facts.length} fact(s)` : ""}`}
        actions={
          <div className="flex items-center gap-3">
            <LiveHeartbeat
              lastHeartbeat={data.lastHeartbeat}
              isActive={isActive}
            />
            <EtlStatusBadge status={data.status} />
            {isActive ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={cancel.isPending}
                onClick={() => setConfirmingCancel(true)}
              >
                <XCircle aria-hidden className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={rerunHref(data)}>
                  <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                  Re-run
                </Link>
              </Button>
            )}
            {isFetching && isActive ? (
              <span
                aria-label="Refrescando"
                className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]"
              >
                <RefreshCw aria-hidden className="h-3 w-3 animate-spin" />
              </span>
            ) : null}
          </div>
        }
      />

      {confirmingCancel ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <p className="text-sm">
              ¿Cancelar la corrida <code className="font-mono text-xs">{shortId(data.id)}</code>?
              El runner detectará el cambio en su próximo heartbeat (≤30 s).
            </p>
            {cancel.isError ? (
              <p className="text-xs text-[var(--color-destructive)]">
                {cancel.error?.message}
              </p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cancel-motivo" className="text-xs text-[var(--color-text-muted)]">
                Motivo (opcional)
              </label>
              <textarea
                id="cancel-motivo"
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                disabled={cancel.isPending}
                rows={2}
                maxLength={500}
                placeholder="Ej: datos de entrada incorrectos, lanzamiento duplicado…"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-60"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={cancel.isPending}
                onClick={() =>
                  cancel.mutate(
                    { id: data.id, comentario: cancelMotivo.trim() || undefined },
                    { onSuccess: () => { setConfirmingCancel(false); setCancelMotivo(""); } },
                  )
                }
              >
                Sí, cancelar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={cancel.isPending}
                onClick={() => { setConfirmingCancel(false); setCancelMotivo(""); }}
              >
                Volver
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data.finalMessage && data.status === "failed" ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <AlertTriangle
              aria-hidden
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-destructive)]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-destructive)]">
                Falla terminal
              </p>
              <p className="break-words text-xs text-[var(--color-text-secondary)]">
                {data.finalMessage}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>Estado actual del runner</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Meta label="Solicitada" value={fmt(data.requestedAt)} />
          <Meta label="Iniciada" value={fmt(data.startedAt)} />
          <Meta label="Finalizada" value={fmt(data.endedAt)} />
          <Meta label="Duración" value={fmtDur(data.durationSec)} />
          <Meta label="Intento" value={`${data.attempt} / ${data.maxAttempts}`} />
          <Meta label="Timeout" value={`${data.timeoutSec}s`} />
          <Meta label="Runner PID" value={data.runnerPid ?? "—"} />
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
              Heartbeat
            </div>
            <div className="mt-1">
              <LiveHeartbeat
                lastHeartbeat={data.lastHeartbeat}
                isActive={isActive}
                size="md"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {data.facts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Facts</CardTitle>
            <CardDescription>
              Tablas que esta corrida está procesando
              {data.withDependencies ? " (incluye dependencias)" : ""}
              {data.refreshGold ? " · refresca gold" : ""}
              {data.forceBronzeReread ? " · re-lee bronce" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {data.facts.map((f) => (
                <li
                  key={f}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 font-mono text-xs"
                >
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
          <CardDescription>
            Pasos en orden de ejecución — color refleja el estado actual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PipelineFlow pasos={data.pasos} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execution Log</CardTitle>
          <CardDescription>
            Traza paso a paso con tiempos y errores en línea
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <EtlExecutionLog
            pasos={data.pasos}
            isRunning={isActive}
            className="rounded-t-none border-0 border-t border-[var(--color-border)]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle de pasos</CardTitle>
        </CardHeader>
        <CardContent>
          <PasosTable pasos={data.pasos} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */

function rerunHref(data: import("@/lib/schemas/control-center").CorridaDetail): string {
  const base = "/etl-monitor/lanzar";
  const params = new URLSearchParams();

  if (data.mode === "facts" && data.facts.length > 0) {
    // La launch page solo acepta ?fact= (singular) para pre-selección
    // Pasamos el primero; los demás los tendrá que seleccionar el usuario
    params.set("fact", data.facts[0]);
  }
  // Preservar flags como hints en URL (la launch page los puede leer si quiere)
  if (!data.withDependencies) params.set("deps", "0");
  if (!data.refreshGold) params.set("gold", "0");
  if (!data.forceBronzeReread) params.set("bronce", "0");

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function fmt(iso: string | null): string {
  return iso ? formatDateTime(iso) : "—";
}

function fmtDur(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm font-medium tabular-nums",
          mono && "font-mono",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- Pipeline flow */

function PipelineFlow({ pasos }: { pasos: CorridaPaso[] }) {
  if (pasos.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Sin pasos registrados aún — el runner los publicará cuando inicie.
      </p>
    );
  }
  const sorted = [...pasos].sort((a, b) => a.orden - b.orden);
  return (
    <ol className="flex flex-wrap items-stretch gap-2">
      {sorted.map((p, idx) => (
        <li key={p.idPaso} className="flex items-center gap-2">
          <PasoChip paso={p} />
          {idx < sorted.length - 1 ? (
            <span
              aria-hidden
              className="text-[var(--color-text-muted)] select-none"
            >
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function PasoChip({ paso }: { paso: CorridaPaso }) {
  const tone = pasoTone(paso.status);
  const subtitle =
    paso.durationSec != null
      ? fmtDur(paso.durationSec)
      : paso.status === "running"
        ? "ejecutando…"
        : paso.status === "queued"
          ? "pendiente"
          : "—";

  return (
    <div
      className={cn(
        "min-w-[140px] rounded-md border px-3 py-2",
        tone.border,
        tone.bg,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "h-2 w-2 rounded-full",
            tone.dot,
            paso.status === "running" && "animate-pulse",
          )}
        />
        <span className="text-xs font-medium text-[var(--color-text)]">
          {paso.nombre}
        </span>
      </div>
      <div className="mt-0.5 text-[11px] tabular-nums text-[var(--color-text-muted)]">
        {subtitle}
      </div>
    </div>
  );
}

function pasoTone(status: CorridaPaso["status"]) {
  switch (status) {
    case "success":
      return {
        border: "border-[color-mix(in_oklab,var(--color-success)_30%,transparent)]",
        bg: "bg-[color-mix(in_oklab,var(--color-success)_10%,transparent)]",
        dot: "bg-[var(--color-success)]",
      };
    case "running":
      return {
        border: "border-[color-mix(in_oklab,var(--color-info)_30%,transparent)]",
        bg: "bg-[color-mix(in_oklab,var(--color-info)_10%,transparent)]",
        dot: "bg-[var(--color-info)]",
      };
    case "failed":
      return {
        border:
          "border-[color-mix(in_oklab,var(--color-destructive)_30%,transparent)]",
        bg: "bg-[color-mix(in_oklab,var(--color-destructive)_10%,transparent)]",
        dot: "bg-[var(--color-destructive)]",
      };
    case "queued":
      return {
        border: "border-[var(--color-border)]",
        bg: "bg-[var(--color-surface-2)]",
        dot: "bg-[var(--color-warning)]",
      };
    case "canceled":
      return {
        border: "border-[var(--color-border)]",
        bg: "bg-[var(--color-surface-2)]",
        dot: "bg-[var(--color-text-muted)]",
      };
  }
}

/* -------------------------------------------------------- Pasos table */

function PasosTable({ pasos }: { pasos: CorridaPaso[] }) {
  if (pasos.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Sin pasos registrados.
      </p>
    );
  }
  const sorted = [...pasos].sort((a, b) => a.orden - b.orden);
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          <tr className="border-b border-[var(--color-border)]">
            <th className="px-3 py-2 font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">Paso</th>
            <th className="px-3 py-2 font-semibold">Estado</th>
            <th className="px-3 py-2 font-semibold">Inicio</th>
            <th className="px-3 py-2 font-semibold">Fin</th>
            <th className="px-3 py-2 font-semibold">Duración</th>
            <th className="px-3 py-2 font-semibold">Error</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr
              key={p.idPaso}
              className="border-b border-[var(--color-border)] last:border-0"
            >
              <td className="px-3 py-2 tabular-nums text-xs text-[var(--color-text-muted)]">
                {p.orden}
              </td>
              <td className="px-3 py-2 font-medium">{p.nombre}</td>
              <td className="px-3 py-2">
                <EtlStatusBadge status={p.status} />
              </td>
              <td className="px-3 py-2 tabular-nums text-xs">
                {fmt(p.startedAt)}
              </td>
              <td className="px-3 py-2 tabular-nums text-xs">
                {fmt(p.endedAt)}
              </td>
              <td className="px-3 py-2 tabular-nums text-xs">
                {fmtDur(p.durationSec)}
              </td>
              <td className="px-3 py-2 text-xs text-[var(--color-destructive)]">
                {p.error ? (
                  <span title={p.error} className="line-clamp-1">
                    {p.error}
                  </span>
                ) : (
                  <span className="text-[var(--color-text-muted)]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
