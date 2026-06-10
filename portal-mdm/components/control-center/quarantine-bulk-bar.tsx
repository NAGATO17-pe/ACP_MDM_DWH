"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useRejectQuarantine,
  useResolveQuarantine,
} from "@/hooks/use-quality";
import type { QuarantineRecord } from "@/lib/schemas/quality";
import { useToast } from "@/hooks/use-toast";

interface QuarantineBulkBarProps {
  selected: QuarantineRecord[];
  onClear: () => void;
}

type BulkMode = "resolve" | "reject";

/**
 * Barra flotante visible cuando hay ≥1 registro seleccionado.
 *
 * El backend no expone bulk endpoints todavía, así que aplicamos N PATCH
 * secuenciales con barra de progreso. Cuando exista `PATCH /bulk` el
 * dialog se simplifica a una sola llamada.
 */
export function QuarantineBulkBar({ selected, onClear }: QuarantineBulkBarProps) {
  const [mode, setMode] = useState<BulkMode | null>(null);

  if (selected.length === 0) return null;

  return (
    <>
      <div
        role="region"
        aria-label="Acciones masivas"
        className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-primary)]/40 bg-[color-mix(in_oklab,var(--color-primary)_10%,var(--color-surface))] px-3 py-2 shadow-sm"
      >
        <div className="flex items-center gap-3 text-sm">
          <span className="tabular-nums font-medium text-[var(--color-text)]">
            {selected.length}
          </span>
          <span className="text-[var(--color-text-muted)]">
            {selected.length === 1 ? "registro seleccionado" : "registros seleccionados"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => setMode("resolve")}
            aria-label="Resolver registros seleccionados"
          >
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
            Resolver…
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setMode("reject")}
            aria-label="Rechazar registros seleccionados"
          >
            <XCircle aria-hidden className="h-3.5 w-3.5" />
            Rechazar…
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            aria-label="Limpiar selección"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
            Limpiar
          </Button>
        </div>
      </div>

      {mode !== null ? (
        <BulkConfirmDialog
          key={mode}
          mode={mode}
          selected={selected}
          onClose={(success) => {
            setMode(null);
            if (success) onClear();
          }}
        />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */

interface BulkConfirmDialogProps {
  mode: BulkMode;
  selected: QuarantineRecord[];
  onClose: (success: boolean) => void;
}

interface FailedItem {
  id: string;
  tabla: string;
  message: string;
}

function BulkConfirmDialog({ mode, selected, onClose }: BulkConfirmDialogProps) {
  const [valorCanonico, setValorCanonico] = useState("");
  const [motivo, setMotivo] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState<FailedItem[]>([]);
  const resolveMutation = useResolveQuarantine();
  const rejectMutation = useRejectQuarantine();
  const { toast } = useToast();

  const total = selected.length;
  const inputValid =
    mode === "resolve" ? valorCanonico.trim().length > 0 : motivo.trim().length > 0;

  async function run() {
    if (!inputValid || running) return;
    setRunning(true);
    setProgress(0);
    const failures: FailedItem[] = [];

    for (let i = 0; i < selected.length; i++) {
      const r = selected[i];
      try {
        if (mode === "resolve") {
          await resolveMutation.mutateAsync({
            tabla: r.tablaOrigen,
            id: r.idRegistro,
            valorCanonico: valorCanonico.trim(),
            comentario: null,
          });
        } else {
          await rejectMutation.mutateAsync({
            tabla: r.tablaOrigen,
            id: r.idRegistro,
            motivo: motivo.trim(),
          });
        }
      } catch (err) {
        failures.push({
          id: r.idRegistro,
          tabla: r.tablaOrigen,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      setProgress(i + 1);
    }

    setRunning(false);
    setFailed(failures);

    const ok = total - failures.length;
    if (failures.length === 0) {
      toast({
        variant: "success",
        title: `${ok} ${ok === 1 ? "registro" : "registros"} ${
          mode === "resolve" ? "resueltos" : "descartados"
        }`,
      });
      onClose(true);
    } else if (ok > 0) {
      toast({
        variant: "warning",
        title: `${ok} OK, ${failures.length} con error`,
        description: "Revisa el detalle antes de cerrar.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "No se pudo aplicar ningún cambio",
      });
    }
  }

  const verb = mode === "resolve" ? "Resolver" : "Rechazar";
  const completed = !running && progress > 0;

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && !running && onClose(false)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <DialogPrimitive.Title className="text-base font-semibold text-[var(--color-text)]">
            {verb} {total} {total === 1 ? "registro" : "registros"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-xs text-[var(--color-text-muted)]">
            {mode === "resolve"
              ? "Se aplicará el mismo valor canónico a todos los seleccionados."
              : "Se descartarán todos los seleccionados con el mismo motivo."}
          </DialogPrimitive.Description>

          <div className="mt-4 flex flex-col gap-3">
            {mode === "resolve" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulk-canonico">
                  Valor canónico{" "}
                  <span aria-hidden className="text-[var(--color-destructive)]">
                    *
                  </span>
                </Label>
                <input
                  id="bulk-canonico"
                  autoFocus
                  required
                  disabled={running}
                  value={valorCanonico}
                  onChange={(e) => setValorCanonico(e.target.value)}
                  maxLength={200}
                  placeholder="Valor a homologar"
                  className="bg-surface h-10 w-full rounded-md border border-[var(--color-border)] px-3 text-sm transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-60"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulk-motivo">
                  Motivo{" "}
                  <span aria-hidden className="text-[var(--color-destructive)]">
                    *
                  </span>
                </Label>
                <textarea
                  id="bulk-motivo"
                  autoFocus
                  required
                  disabled={running}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Motivo del descarte masivo"
                  className="bg-surface w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-60"
                />
              </div>
            )}

            {running || completed ? (
              <div
                aria-live="polite"
                className="flex flex-col gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between text-[var(--color-text-muted)]">
                  <span>Progreso</span>
                  <span className="tabular-nums">
                    {progress} / {total}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={progress}
                  className="h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]"
                >
                  <div
                    className="h-full bg-[var(--color-primary)] transition-all"
                    style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ) : null}

            {completed && failed.length > 0 ? (
              <div
                role="alert"
                className="flex flex-col gap-2 rounded-md border border-[var(--color-destructive)]/40 bg-[color-mix(in_oklab,var(--color-destructive)_8%,transparent)] px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 text-[var(--color-destructive)]">
                  <AlertTriangle aria-hidden className="h-4 w-4" />
                  <span className="font-medium">
                    {failed.length} {failed.length === 1 ? "fallo" : "fallos"}
                  </span>
                </div>
                <ul className="max-h-32 overflow-y-auto pl-1 text-[var(--color-text-muted)]">
                  {failed.slice(0, 8).map((f) => (
                    <li key={`${f.tabla}-${f.id}`} className="truncate" title={f.message}>
                      <span className="font-mono">
                        {f.tabla}#{f.id}
                      </span>
                      <span aria-hidden> · </span>
                      {f.message}
                    </li>
                  ))}
                  {failed.length > 8 ? (
                    <li className="text-[var(--color-text-muted)]">
                      …y {failed.length - 8} más
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onClose(false)} disabled={running}>
              {completed ? "Cerrar" : "Cancelar"}
            </Button>
            {!completed ? (
              <Button
                variant={mode === "reject" ? "destructive" : "primary"}
                onClick={run}
                disabled={!inputValid || running}
                aria-busy={running}
              >
                {running ? (
                  <>
                    <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                    Aplicando…
                  </>
                ) : (
                  `${verb} ${total}`
                )}
              </Button>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
