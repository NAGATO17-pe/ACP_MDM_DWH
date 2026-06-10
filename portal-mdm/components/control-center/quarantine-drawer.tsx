"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useId, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import {
  useRejectQuarantine,
  useResolveQuarantine,
} from "@/hooks/use-quality";
import type { QuarantineRecord } from "@/lib/schemas/quality";
import { useToast } from "@/hooks/use-toast";
import { QuarantineCompositeEditor } from "@/components/control-center/quarantine-composite-editor";
import {
  assembleComposite,
  parseComposite,
} from "@/lib/quarantine/parse-composite";

interface QuarantineDrawerProps {
  record: QuarantineRecord | null;
  onClose: () => void;
}

type Mode = "resolve" | "reject";

/**
 * Modal centrado de cuarentena.
 *
 * Antes era un drawer lateral 400px — el operador no veía el contexto
 * y la acción al mismo tiempo. Ahora es un modal de 2 columnas
 * (lg: lado a lado, mobile: stack) donde:
 *
 *   - Columna izquierda: contexto del registro (origen, valor recibido,
 *     motivo del rechazo). Lectura.
 *   - Columna derecha: acción a aplicar (resolver con valor canónico,
 *     o rechazar con motivo). Decisión.
 *
 * El componente sigue llamándose `QuarantineDrawer` para no romper el
 * import en `quality-client.tsx`.
 */
export function QuarantineDrawer({ record, onClose }: QuarantineDrawerProps) {
  const open = record !== null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/65 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[min(960px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)]",
            "flex flex-col overflow-hidden",
            "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          {record ? (
            <ModalBody
              key={`${record.tablaOrigen}::${record.idRegistro}`}
              record={record}
              onClose={onClose}
            />
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------- */

interface ModalBodyProps {
  record: QuarantineRecord;
  onClose: () => void;
}

function ModalBody({ record, onClose }: ModalBodyProps) {
  const headingId = useId();
  const descId = useId();
  const [mode, setMode] = useState<Mode>("resolve");
  // El editor compuesto controla este array y nos avisa por callback.
  // Para registros simples queda como `[valorRaw]`.
  const parsed = useMemo(
    () => parseComposite(record.columnaOrigen, record.valorRaw),
    [record.columnaOrigen, record.valorRaw],
  );
  const [editedValues, setEditedValues] = useState<string[]>(() =>
    parsed.kind === "composite"
      ? parsed.fields.map((f) => f.raw)
      : [parsed.rawFallback ?? record.valorRaw],
  );
  const [comentario, setComentario] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmReject, setConfirmReject] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const resolveMutation = useResolveQuarantine();
  const rejectMutation = useRejectQuarantine();
  const { toast } = useToast();

  const pending = resolveMutation.isPending || rejectMutation.isPending;
  // Para considerar "submittable": al menos un valor no vacío (cubre simple
  // y compuesto en una sola condición).
  const valorCanonico = assembleComposite(parsed, editedValues);
  const canSubmit =
    mode === "resolve"
      ? valorCanonico.trim().length > 0 && !pending
      : motivo.trim().length > 0 && !pending;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setMutationError(null);

    if (mode === "reject" && !confirmReject) {
      setConfirmReject(true);
      return;
    }

    const onSuccess = (msg: string) => {
      toast({ variant: "success", title: msg });
      onClose();
    };
    const onError = (err: unknown) => {
      const m = err instanceof Error ? err.message : String(err);
      setMutationError(m);
      toast({ variant: "destructive", title: "No se pudo aplicar", description: m });
    };

    if (mode === "resolve") {
      resolveMutation.mutate(
        {
          tabla: record.tablaOrigen,
          id: record.idRegistro,
          valorCanonico: valorCanonico.trim(),
          comentario: comentario.trim() || null,
        },
        {
          onSuccess: () => onSuccess(`Registro #${record.idRegistro} resuelto`),
          onError,
        },
      );
    } else {
      rejectMutation.mutate(
        {
          tabla: record.tablaOrigen,
          id: record.idRegistro,
          motivo: motivo.trim(),
        },
        {
          onSuccess: () => onSuccess(`Registro #${record.idRegistro} descartado`),
          onError,
        },
      );
    }
  }

  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-6 py-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <DialogPrimitive.Title
            id={headingId}
            className="text-lg font-semibold leading-none tracking-tight text-[var(--color-text)]"
          >
            Registro en cuarentena
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            id={descId}
            className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]"
          >
            <span className="font-mono">#{record.idRegistro}</span>
            <span aria-hidden>·</span>
            <StatusBadge
              tone="warning"
              label={record.estado}
              variant="pill"
              size="sm"
            />
          </DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close
          aria-label="Cerrar"
          className="rounded-sm p-1 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_1.05fr]"
      >
        {/* Columna izquierda — CONTEXTO */}
        <section
          aria-label="Contexto del registro"
          className="flex flex-col gap-4 overflow-y-auto bg-[var(--color-surface-2)]/40 px-6 py-5"
        >
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
            Origen del dato
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <Kv label="Tabla" value={record.tablaOrigen} mono />
            {record.idRegistroOrigen != null ? (
              <Kv label="Registro origen" value={`#${record.idRegistroOrigen}`} />
            ) : null}
            {record.nombreArchivo ? (
              <Kv label="Archivo" value={record.nombreArchivo} mono />
            ) : null}
            {record.fechaIngreso ? (
              <Kv
                label="Ingresado"
                value={formatDateTime(record.fechaIngreso)}
              />
            ) : null}
          </dl>

          {/*
            En la columna izquierda mostramos los valores recibidos en modo
            LECTURA — útil para usuarios que sólo quieren entender qué llegó
            sin tocar el campo canónico. El editor de la derecha mostrará lo
            mismo pero con inputs editables (modo "edit").
          */}
          <QuarantineCompositeEditor
            key={`view-${record.tablaOrigen}-${record.idRegistro}`}
            columnaOrigen={record.columnaOrigen}
            valorRaw={record.valorRaw}
            mode="view"
            onChange={() => {
              /* no-op en modo view */
            }}
          />

          {record.motivo ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                Razón del rechazo
              </h3>
              <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                {record.motivo}
              </p>
            </div>
          ) : null}
        </section>

        {/* Columna derecha — ACCIÓN */}
        <section
          aria-label="Acción a aplicar"
          className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5"
        >
          <fieldset
            aria-label="Tipo de acción"
            className="flex flex-col gap-2"
            disabled={pending}
          >
            <legend className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              Decisión MDM
            </legend>
            <ModeRadio
              active={mode === "resolve"}
              onClick={() => {
                setMode("resolve");
                setConfirmReject(false);
                setMutationError(null);
              }}
              icon={<CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />}
              title="Resolver con valor canónico"
              description="Marca como RESUELTO y guarda el valor homologado para futuras lecturas."
            />
            <ModeRadio
              active={mode === "reject"}
              onClick={() => {
                setMode("reject");
                setMutationError(null);
              }}
              icon={<XCircle className="h-4 w-4 text-[var(--color-destructive)]" />}
              title="Rechazar"
              description="Descarta el registro. No se reintegra al DWH."
            />
          </fieldset>

          {mode === "resolve" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>
                  Valor canónico{" "}
                  <span aria-hidden className="text-[var(--color-destructive)]">
                    *
                  </span>
                </Label>
                <QuarantineCompositeEditor
                  key={`edit-${record.tablaOrigen}-${record.idRegistro}`}
                  columnaOrigen={record.columnaOrigen}
                  valorRaw={record.valorRaw}
                  mode="edit"
                  onChange={setEditedValues}
                />
                <p className="text-xs text-[var(--color-text-muted)]">
                  Edita los campos que necesiten corregirse. El sistema
                  re-ensambla el valor que se guardará. Máx. 200 caracteres en
                  total.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="comentario">Comentario (opcional)</Label>
                <textarea
                  id="comentario"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Notas para auditoría"
                  className="bg-surface min-h-[96px] w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motivo">
                Motivo del descarte{" "}
                <span aria-hidden className="text-[var(--color-destructive)]">
                  *
                </span>
              </Label>
              <textarea
                id="motivo"
                autoFocus
                required
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  setConfirmReject(false);
                }}
                maxLength={500}
                rows={5}
                placeholder="Explica por qué el registro no debe ser homologado"
                className="bg-surface w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-60"
              />
              <p className="text-xs text-[var(--color-text-muted)]">
                Queda registrado en auditoría con tu usuario. Máx. 500 caracteres.
              </p>
            </div>
          )}

          {mutationError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--color-destructive)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-destructive)_10%,transparent)] px-3 py-2 text-xs text-[var(--color-destructive)]"
            >
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{mutationError}</span>
            </div>
          ) : null}

          {mode === "reject" && confirmReject && !mutationError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--color-warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-warning)_10%,transparent)] px-3 py-2 text-xs text-[var(--color-warning)]"
            >
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Vas a descartar este registro. La acción queda auditada y no se
                puede deshacer desde la UI. Presiona{" "}
                <strong>Confirmar descarte</strong> para continuar.
              </span>
            </div>
          ) : null}

          <div className="mt-auto flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={mode === "reject" ? "destructive" : "primary"}
              disabled={!canSubmit}
              aria-busy={pending}
            >
              {pending ? (
                <>
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                  Aplicando…
                </>
              ) : mode === "reject" ? (
                confirmReject ? "Confirmar descarte" : "Rechazar"
              ) : (
                "Resolver"
              )}
            </Button>
          </div>
        </section>
      </form>
    </>
  );
}

/* -------------------------------------------------------------------------- */

interface KvProps {
  label: string;
  value: string;
  mono?: boolean;
}

function Kv({ label, value, mono }: KvProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd
        className={cn(
          "truncate text-[var(--color-text)]",
          mono && "font-mono",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

interface ModeRadioProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ModeRadio({ active, onClick, icon, title, description }: ModeRadioProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition",
        "duration-[var(--motion-base)]",
        active
          ? "border-[var(--color-primary)] bg-[color-mix(in_oklab,var(--color-primary)_10%,transparent)]"
          : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-text-muted)]",
      )}
    >
      <span aria-hidden className="mt-0.5">
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--color-text)]">{title}</span>
        <span className="text-xs text-[var(--color-text-muted)]">{description}</span>
      </span>
    </button>
  );
}
