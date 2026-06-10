"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useId } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardCopy,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useBitacoraDetail } from "@/hooks/use-bitacora";
import type { BitacoraEntry } from "@/lib/schemas/bitacora";
import { BitacoraStatusBadge } from "./bitacora-status-badge";
import { useToast } from "@/hooks/use-toast";

interface Props {
  idLog: number | null;
  onClose: () => void;
}

/**
 * Drawer lateral de detalle de bitácora.
 *
 * Carga el detalle completo del backend (mensaje_error sin truncar) al abrir.
 * Solo-lectura — sin acciones destructivas.
 */
export function BitacoraDetailDrawer({ idLog, onClose }: Props) {
  const open = idLog !== null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col",
            "border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
          )}
        >
          {idLog !== null ? (
            <DrawerBody key={idLog} idLog={idLog} onClose={onClose} />
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------- */

function DrawerBody({ idLog, onClose }: { idLog: number; onClose: () => void }) {
  const headingId = useId();
  const { data, isLoading, isError, error, refetch } = useBitacoraDetail(idLog);

  return (
    <>
      <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex flex-col gap-1">
          <DialogPrimitive.Title
            id={headingId}
            className="text-base font-semibold text-[var(--color-text)]"
          >
            Detalle de bitácora
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-xs text-[var(--color-text-muted)]">
            ID_Log_Carga{" "}
            <span className="font-mono text-[var(--color-text-secondary)]">
              #{idLog}
            </span>
          </DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close
          aria-label="Cerrar"
          className="rounded-sm p-1 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            Cargando detalle…
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-md border border-[var(--color-destructive)]/40 bg-[color-mix(in_oklab,var(--color-destructive)_8%,transparent)] px-3 py-3 text-sm text-[var(--color-destructive)]"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                No se pudo cargar el detalle.{" "}
                {error instanceof Error ? error.message : null}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        ) : data ? (
          <DetailBody data={data} />
        ) : null}
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </footer>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function DetailBody({ data }: { data: BitacoraEntry }) {
  const { toast } = useToast();
  const duracion = formatDuracion(data.duracionSegundos);

  function copyError() {
    if (!data.mensajeError) return;
    navigator.clipboard.writeText(data.mensajeError).then(
      () => toast({ variant: "success", title: "Error copiado al portapapeles" }),
      () => toast({ variant: "destructive", title: "No se pudo copiar" }),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Resumen"
        className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Tabla destino
            </p>
            <p className="font-mono text-sm font-medium text-[var(--color-text)]">
              {data.tablaDestino}
            </p>
          </div>
          <BitacoraStatusBadge estado={data.estado} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Kv label="Proceso" value={data.nombreProceso} mono />
          {data.nombreArchivo ? (
            <Kv label="Archivo" value={data.nombreArchivo} mono />
          ) : null}
          <Kv
            label="Inicio"
            value={data.fechaInicio ? formatDateTime(data.fechaInicio) : "—"}
          />
          <Kv
            label="Fin"
            value={data.fechaFin ? formatDateTime(data.fechaFin) : "—"}
          />
          <Kv label="Duración" value={duracion} />
          {data.idCorrida ? (
            <Kv label="ID corrida" value={data.idCorrida} mono />
          ) : null}
        </div>
      </section>

      <section aria-label="Métricas" className="grid grid-cols-2 gap-3">
        <MetricTile
          label="Filas OK"
          value={formatNumber(data.filasInsertadas)}
          tone="success"
        />
        <MetricTile
          label="Filas rechazadas"
          value={formatNumber(data.filasRechazadas)}
          tone={data.filasRechazadas > 0 ? "destructive" : "muted"}
        />
      </section>

      {data.mensajeError ? (
        <section aria-label="Mensaje de error" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Mensaje de error
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copyError}
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <ClipboardCopy aria-hidden className="h-3.5 w-3.5" />
              Copiar
            </Button>
          </div>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-[var(--color-destructive)]/30 bg-[color-mix(in_oklab,var(--color-destructive)_8%,transparent)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--color-text)]">
            {data.mensajeError}
          </pre>
        </section>
      ) : null}

      {data.idCorrida ? (
        <section aria-label="Acciones" className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            Trazabilidad
          </p>
          <Link
            href={`/etl-monitor/${data.idCorrida}`}
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            Abrir corrida en monitor
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        </section>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function formatDuracion(seg: number | null): string {
  if (seg == null) return "—";
  if (seg < 60) return `${seg}s`;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function Kv({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span
        className={cn(
          "truncate text-[var(--color-text)]",
          mono && "font-mono text-[13px]",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

interface MetricTileProps {
  label: string;
  value: string;
  tone: "success" | "destructive" | "muted";
}

function MetricTile({ label, value, tone }: MetricTileProps) {
  const toneClass = {
    success: "text-[var(--color-success)]",
    destructive: "text-[var(--color-destructive)]",
    muted: "text-[var(--color-text-muted)]",
  }[tone];
  return (
    <div className="flex flex-col gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5">
      <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </span>
      <span className={cn("text-lg font-semibold tabular-nums", toneClass)}>
        {value}
      </span>
    </div>
  );
}
