"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronRight,
  Database,
  GitBranch,
  Layers,
  Loader2,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useActiveCorridas,
  useFactCatalog,
  useLaunchCorrida,
} from "@/hooks/use-etl-launch";
import type { FactDisponible } from "@/lib/schemas/etl-launch";

function findFactByNombre(
  facts: FactDisponible[],
  nombre: string,
): FactDisponible | undefined {
  return facts.find((f) => f.nombre === nombre);
}

type Mode = "completo" | "facts";

interface Flags {
  incluirDependencias: boolean;
  refrescarGold: boolean;
  forzarRelecturaBronce: boolean;
}

const DEFAULT_FLAGS: Flags = {
  incluirDependencias: true,
  refrescarGold: true,
  forzarRelecturaBronce: true,
};

export function LaunchEtlClient() {
  const router = useRouter();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("completo");
  const [selectedFacts, setSelectedFacts] = useState<Set<string>>(new Set());
  const [flags, setFlags] = useState<Flags>(DEFAULT_FLAGS);
  const [comentario, setComentario] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const searchParams = useSearchParams();

  const catalog = useFactCatalog();
  const active = useActiveCorridas();
  const launch = useLaunchCorrida();

  const facts = useMemo(() => catalog.data ?? [], [catalog.data]);

  // Pre-select a fact when arriving from a "Relanzar" link.
  const preselectedFact = searchParams.get("fact");
  const didPreselect = useRef(false);
  useEffect(() => {
    if (didPreselect.current) return;
    if (!preselectedFact || facts.length === 0) return;
    didPreselect.current = true;
    const match = findFactByNombre(facts, preselectedFact);
    if (match) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("facts");
      setSelectedFacts(new Set([preselectedFact]));
    } else {
      toast({
        variant: "destructive",
        title: "Fact no encontrado",
        description: `El fact '${preselectedFact}' no existe en el catálogo`,
      });
    }
  }, [preselectedFact, facts, toast]);
  const hasActive = (active.data?.length ?? 0) > 0;

  const factsToRun = mode === "facts" ? Array.from(selectedFacts) : null;
  const canSubmit =
    !launch.isPending &&
    (mode === "completo" || (mode === "facts" && selectedFacts.size > 0));

  function toggleFact(name: string) {
    setSelectedFacts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function selectAll() {
    setSelectedFacts(new Set(facts.map((f) => f.nombre)));
  }

  function clearAll() {
    setSelectedFacts(new Set());
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setConfirmOpen(true);
  }

  function handleConfirm() {
    setConfirmOpen(false);
    launch.mutate(
      {
        comentario: comentario.trim() || null,
        modoEjecucion: mode,
        facts: factsToRun,
        incluirDependencias: flags.incluirDependencias,
        refrescarGold: flags.refrescarGold,
        forzarRelecturaBronce: flags.forzarRelecturaBronce,
      },
      {
        onSuccess: (data) => {
          toast({
            variant: "success",
            title: "Corrida encolada",
            description:
              mode === "facts"
                ? `${factsToRun?.length ?? 0} fact(s) en cola.`
                : "Pipeline completo en cola.",
          });
          router.push(`/etl-monitor/${data.id}`);
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "No se pudo lanzar",
            description: err instanceof Error ? err.message : String(err),
          });
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <PageHeader
        title="Lanzar corrida ETL"
        description="Reemplaza al .bat: encola el pipeline desde el portal y aterriza en su detalle en vivo. Requiere rol operador_etl o superior."
      />

      <ActiveCorridaBanner
        loading={active.isLoading}
        active={active.data ?? []}
        hasActive={hasActive}
      />

      <ModeSelector mode={mode} onChange={setMode} disabled={launch.isPending} />

      {mode === "facts" ? (
        catalog.isError && preselectedFact && facts.length === 0 ? (
          <div
            role="alert"
            className="rounded border border-[var(--color-destructive)]/40 bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-text-muted)]"
          >
            No se pudo cargar el catálogo de facts. El fact pre-seleccionado{" "}
            <span className="font-mono text-[var(--color-text)]">
              {preselectedFact}
            </span>{" "}
            no puede verificarse hasta que el catálogo esté disponible.{" "}
            <button
              type="button"
              onClick={() => catalog.refetch()}
              className="underline hover:text-[var(--color-text)]"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <FactsPicker
            loading={catalog.isLoading}
            error={catalog.error}
            facts={facts}
            selected={selectedFacts}
            onToggle={toggleFact}
            onSelectAll={selectAll}
            onClear={clearAll}
            disabled={launch.isPending}
            onRetry={() => catalog.refetch()}
          />
        )
      ) : null}

      <FlagsPanel value={flags} onChange={setFlags} disabled={launch.isPending} />

      <CommentField
        value={comentario}
        onChange={setComentario}
        disabled={launch.isPending}
      />

      <FooterActions
        canSubmit={canSubmit}
        pending={launch.isPending}
        mode={mode}
        facts={factsToRun}
      />

      <ConfirmLaunchDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirm}
        mode={mode}
        facts={factsToRun}
        flags={flags}
      />
    </form>
  );
}

/* ── Banner: corridas activas ────────────────────────────────────────────── */

interface ActiveCorridaBannerProps {
  loading: boolean;
  active: { id: string; estado: string; iniciadoPor: string | null; facts: string[] }[];
  hasActive: boolean;
}

function ActiveCorridaBanner({ loading, active, hasActive }: ActiveCorridaBannerProps) {
  if (loading) return <Skeleton className="h-14 rounded-md" />;
  if (!hasActive) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-warning)]/40 bg-[color-mix(in_oklab,var(--color-warning)_10%,var(--color-surface))] px-4 py-3"
    >
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]"
        />
        <div className="flex flex-col gap-0.5">
          <p className="font-medium text-[var(--color-text)]">
            {active.length === 1
              ? "Hay una corrida activa en este momento"
              : `Hay ${active.length} corridas activas en este momento`}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Puedes lanzar otra; el runner las procesa según su política de
            concurrencia. Revisa el detalle de la activa antes de continuar.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {active.slice(0, 3).map((c) => (
          <Link
            key={c.id}
            href={`/etl-monitor/${c.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-mono text-[var(--color-primary)] hover:underline"
          >
            #{c.id.slice(0, 8)}
            <ChevronRight aria-hidden className="h-3 w-3" />
          </Link>
        ))}
        {active.length > 3 ? (
          <span className="text-xs text-[var(--color-text-muted)]">
            + {active.length - 3} más en cola
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ── Mode selector ───────────────────────────────────────────────────────── */

interface ModeSelectorProps {
  mode: Mode;
  onChange: (m: Mode) => void;
  disabled: boolean;
}

function ModeSelector({ mode, onChange, disabled }: ModeSelectorProps) {
  return (
    <fieldset
      aria-label="Modo de ejecución"
      disabled={disabled}
      className="flex flex-col gap-2"
    >
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        Modo
      </legend>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <ModeCard
          active={mode === "completo"}
          onClick={() => onChange("completo")}
          icon={<Workflow className="h-5 w-5 text-[var(--color-primary)]" />}
          title="Completo"
          description="Ejecuta todo el pipeline: dimensiones, todos los facts y marts Gold en orden."
          hint="Equivalente a correr el pipeline.bat completo."
        />
        <ModeCard
          active={mode === "facts"}
          onClick={() => onChange("facts")}
          icon={<Sparkles className="h-5 w-5 text-[var(--color-info)]" />}
          title="Por Facts"
          description="Reproceso dirigido. Selecciona qué facts ejecutar y el runner respeta dependencias."
          hint="Útil para reprocesar después de homologar o corregir datos."
        />
      </div>
    </fieldset>
  );
}

interface ModeCardProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  hint: string;
}

function ModeCard({ active, onClick, icon, title, description, hint }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col gap-2 rounded-md border p-4 text-left transition",
        active
          ? "border-[var(--color-primary)] bg-[color-mix(in_oklab,var(--color-primary)_8%,var(--color-surface))]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-muted)]",
      )}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden>{icon}</span>
        <span className="text-base font-semibold text-[var(--color-text)]">
          {title}
        </span>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
    </button>
  );
}

/* ── Facts picker ────────────────────────────────────────────────────────── */

interface FactsPickerProps {
  loading: boolean;
  error: Error | null;
  facts: FactDisponible[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  disabled: boolean;
  onRetry: () => void;
}

function FactsPicker({
  loading,
  error,
  facts,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  disabled,
  onRetry,
}: FactsPickerProps) {
  return (
    <fieldset
      aria-label="Facts a procesar"
      disabled={disabled}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Facts a procesar
          {selected.size > 0 ? (
            <span className="ml-2 normal-case text-[var(--color-text)]">
              ({selected.size} seleccionado{selected.size === 1 ? "" : "s"})
            </span>
          ) : null}
        </legend>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onSelectAll}
            disabled={facts.length === 0}
          >
            Seleccionar todos
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClear}
            disabled={selected.size === 0}
          >
            Limpiar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
      ) : error || facts.length === 0 ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-destructive)]/40 bg-[var(--color-surface-2)] p-3 text-sm"
        >
          <div className="flex items-center gap-2 text-[var(--color-destructive)]">
            <AlertTriangle aria-hidden className="h-4 w-4" />
            <span>
              {error
                ? "No se pudo cargar el catálogo."
                : "El catálogo de facts está vacío."}
            </span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {facts.map((f) => (
            <FactRow
              key={f.nombre}
              fact={f}
              selected={selected.has(f.nombre)}
              onToggle={() => onToggle(f.nombre)}
            />
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function FactRow({
  fact,
  selected,
  onToggle,
}: {
  fact: FactDisponible;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label
        className={cn(
          "flex h-full cursor-pointer flex-col gap-1.5 rounded-md border p-3 transition",
          selected
            ? "border-[var(--color-primary)] bg-[color-mix(in_oklab,var(--color-primary)_8%,var(--color-surface))]"
            : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-muted)]",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              className="h-4 w-4 accent-[var(--color-primary)]"
              aria-label={`Procesar ${fact.nombre}`}
            />
            <span className="truncate font-mono text-sm font-medium text-[var(--color-text)]">
              {fact.nombre}
            </span>
          </div>
          <Badge variant="default" className="shrink-0">
            #{fact.orden}
          </Badge>
        </div>
        <div className="flex flex-col gap-0.5 text-[11px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <Database aria-hidden className="h-3 w-3" />
            <span className="truncate font-mono" title={fact.tablaDestino}>
              {fact.tablaDestino}
            </span>
          </span>
          {fact.dependencias.length > 0 ? (
            <span className="flex items-center gap-1">
              <GitBranch aria-hidden className="h-3 w-3" />
              <span className="truncate" title={fact.dependencias.join(", ")}>
                Deps: {fact.dependencias.join(", ")}
              </span>
            </span>
          ) : null}
          {fact.marts.length > 0 ? (
            <span className="flex items-center gap-1">
              <Layers aria-hidden className="h-3 w-3" />
              <span className="truncate" title={fact.marts.join(", ")}>
                Marts: {fact.marts.join(", ")}
              </span>
            </span>
          ) : null}
        </div>
      </label>
    </li>
  );
}

/* ── Flags ───────────────────────────────────────────────────────────────── */

interface FlagsPanelProps {
  value: Flags;
  onChange: (next: Flags) => void;
  disabled: boolean;
}

function FlagsPanel({ value, onChange, disabled }: FlagsPanelProps) {
  return (
    <fieldset
      aria-label="Flags de ejecución"
      disabled={disabled}
      className="flex flex-col gap-2"
    >
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        Flags
      </legend>
      <div className="flex flex-col gap-2">
        <FlagToggle
          checked={value.incluirDependencias}
          onChange={(v) => onChange({ ...value, incluirDependencias: v })}
          title="Incluir dependencias"
          description="Ejecuta dimensiones y procedimientos dependientes antes de los facts seleccionados."
        />
        <FlagToggle
          checked={value.refrescarGold}
          onChange={(v) => onChange({ ...value, refrescarGold: v })}
          title="Refrescar Gold"
          description="Refresca los marts Gold impactados después de los facts."
        />
        <FlagToggle
          checked={value.forzarRelecturaBronce}
          onChange={(v) => onChange({ ...value, forzarRelecturaBronce: v })}
          title="Forzar relectura de Bronce"
          description="Reabre filas en estado PROCESADO o RECHAZADO en Bronce para que se reprocesen."
        />
      </div>
    </fieldset>
  );
}

interface FlagToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
}

function FlagToggle({ checked, onChange, title, description }: FlagToggleProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition",
        checked
          ? "border-[var(--color-primary)]/50 bg-[color-mix(in_oklab,var(--color-primary)_6%,var(--color-surface))]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-muted)]",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--color-text)]">{title}</span>
        <span className="text-xs text-[var(--color-text-muted)]">{description}</span>
      </span>
    </label>
  );
}

/* ── Comment ─────────────────────────────────────────────────────────────── */

interface CommentFieldProps {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}

function CommentField({ value, onChange, disabled }: CommentFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="comentario">Comentario (opcional)</Label>
      <textarea
        id="comentario"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={500}
        rows={2}
        placeholder="Contexto del run (ej. 'reproceso tras homologar variedades')"
        className="bg-surface w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-60"
      />
      <p className="text-xs text-[var(--color-text-muted)]">
        Quedará registrado en auditoría junto con tu usuario. Máx. 500 caracteres.
      </p>
    </div>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

interface FooterActionsProps {
  canSubmit: boolean;
  pending: boolean;
  mode: Mode;
  facts: string[] | null;
}

/* ── Confirmation dialog ─────────────────────────────────────────────────── */

function ConfirmLaunchDialog({
  open,
  onOpenChange,
  onConfirm,
  mode,
  facts,
  flags,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  mode: Mode;
  facts: string[] | null;
  flags: Flags;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar lanzamiento</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">Modo:</span>
            <span className="font-medium text-[var(--color-text)]">
              {mode === "completo"
                ? "Pipeline completo"
                : `${facts?.length ?? 0} fact${(facts?.length ?? 0) === 1 ? "" : "s"} seleccionado${(facts?.length ?? 0) === 1 ? "" : "s"}`}
            </span>
          </div>
          {mode === "facts" && facts && facts.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {facts.map((f) => (
                <li
                  key={f}
                  className="rounded bg-[var(--color-surface-2)] px-2 py-0.5 font-mono text-xs text-[var(--color-text)]"
                >
                  {f}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)]">
            {flags.incluirDependencias && <span>+ Dependencias</span>}
            {flags.refrescarGold && <span>+ Refrescar Gold</span>}
            {flags.forzarRelecturaBronce && <span>+ Releer Bronce</span>}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            La corrida quedará registrada en auditoría con tu usuario.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="button" onClick={onConfirm}>
            <PlayCircle aria-hidden className="h-4 w-4" />
            Confirmar lanzamiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

function FooterActions({ canSubmit, pending, mode, facts }: FooterActionsProps) {
  const summary =
    mode === "completo"
      ? "Pipeline completo"
      : `${facts?.length ?? 0} fact${(facts?.length ?? 0) === 1 ? "" : "s"}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
      <span className="text-xs text-[var(--color-text-muted)]">
        Lanzarás: <span className="font-medium text-[var(--color-text)]">{summary}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button asChild type="button" variant="ghost">
          <Link href="/etl-monitor">Cancelar</Link>
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!canSubmit}
          aria-busy={pending}
        >
          {pending ? (
            <>
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              Encolando…
            </>
          ) : (
            <>
              <PlayCircle aria-hidden className="h-4 w-4" />
              Lanzar corrida
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
