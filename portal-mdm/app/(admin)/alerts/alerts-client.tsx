"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CircleCheck,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAckAlert,
  useActiveAlerts,
  useUnackAlert,
} from "@/hooks/use-control-center";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Alert } from "@/lib/schemas/control-center";
import { useToast } from "@/hooks/use-toast";
import {
  SeverityIcon,
  severityTextColor,
} from "@/components/control-center/severity-chip";
import { RUNBOOK } from "@/lib/control-center/runbook";
import { useUrlState } from "@/hooks/use-url-state";

type Severity = Alert["severity"];
type Filter = "all" | "active" | "acked" | Severity;


const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "active", label: "Sin atender" },
  { id: "critical", label: "Críticas" },
  { id: "warning", label: "Advertencias" },
  { id: "acked", label: "Atendidas" },
];

export function AlertsClient() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useActiveAlerts();
  const [{ filter: rawFilter }, setUrlState] = useUrlState({ filter: "active" });
  const filter: Filter = (["all", "active", "acked", "critical", "warning", "info"] as Filter[]).includes(
    rawFilter as Filter,
  )
    ? (rawFilter as Filter)
    : "active";
  function setFilter(f: Filter) { setUrlState({ filter: f }); }
  const [showAcked, setShowAcked] = useState<boolean>(false);
  const ackMutation = useAckAlert();
  const unackMutation = useUnackAlert();
  const { toast } = useToast();

  const allAlerts = useMemo<Alert[]>(() => data ?? [], [data]);

  const counts = useMemo(() => {
    const c = {
      total: allAlerts.length,
      critical: 0,
      warning: 0,
      info: 0,
      active: 0,
      acked: 0,
    };
    for (const a of allAlerts) {
      c[a.severity]++;
      if (a.acknowledged) c.acked++;
      else c.active++;
    }
    return c;
  }, [allAlerts]);

  /**
   * Lista filtrada por la tab activa. El estado `showAcked` controla la
   * sección colapsable secundaria — sólo aplica cuando la tab es
   * "active" o "all" y hay realmente acks que mostrar.
   */
  const filteredActive = useMemo(() => {
    switch (filter) {
      case "all":
        // "Todas" muestra activas + atendidas en la lista principal.
        // Las atendidas aparecen al fondo con opacity-70 vía AlertRow.
        return allAlerts;
      case "active":
        return allAlerts.filter((a) => !a.acknowledged);
      case "acked":
        return allAlerts.filter((a) => a.acknowledged);
      default:
        return allAlerts.filter(
          (a) => a.severity === filter && !a.acknowledged,
        );
    }
  }, [allAlerts, filter]);

  const filteredAcked = useMemo(() => {
    switch (filter) {
      case "acked":
        return [];
      case "active":
      case "all":
        return allAlerts
          .filter((a) => a.acknowledged)
          .sort((a, b) => {
            const ax = a.ackedAt ? new Date(a.ackedAt).getTime() : 0;
            const bx = b.ackedAt ? new Date(b.ackedAt).getTime() : 0;
            return bx - ax;
          });
      default:
        return allAlerts.filter(
          (a) => a.severity === filter && a.acknowledged,
        );
    }
  }, [allAlerts, filter]);

  function handleAck(a: Alert) {
    ackMutation.mutate(
      { id: a.id },
      {
        onSuccess: () =>
          toast({
            variant: "success",
            title: "Alerta marcada como atendida",
            description: a.source,
          }),
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "No se pudo marcar",
            description: err instanceof Error ? err.message : String(err),
          }),
      },
    );
  }

  function handleUnack(a: Alert) {
    unackMutation.mutate(
      { id: a.id },
      {
        onSuccess: () =>
          toast({
            variant: "success",
            title: "Alerta reabierta",
            description: a.source,
          }),
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "No se pudo reabrir",
            description: err instanceof Error ? err.message : String(err),
          }),
      },
    );
  }

  const showEmptyHero =
    !isLoading &&
    !isError &&
    data != null &&
    filter === "active" &&
    filteredActive.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Total" value={counts.total} />
        <SummaryTile
          label="Críticas"
          value={counts.critical}
          tone="destructive"
        />
        <SummaryTile
          label="Advertencias"
          value={counts.warning}
          tone="warning"
        />
        <SummaryTile label="Atendidas" value={counts.acked} tone="muted" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filtrar alertas"
          className="flex flex-wrap rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "min-h-[32px] px-3 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                filter === f.id
                  ? "bg-[var(--color-primary-solid)] text-[var(--color-primary-foreground)] rounded-md"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          {isFetching ? (
            <span className="flex items-center gap-1">
              <RefreshCw aria-hidden className="h-3 w-3 animate-spin" />
              Refrescando…
            </span>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
            Refrescar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
      ) : isError || !data ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-md border border-[var(--color-destructive)]/40 bg-[var(--color-surface-2)] p-4 text-sm"
        >
          <div className="flex items-center gap-2 text-[var(--color-destructive)]">
            <AlertTriangle aria-hidden className="h-4 w-4" />
            <span className="font-medium">
              No se pudieron cargar las alertas
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {error instanceof Error ? error.message : "Backend no disponible."}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        </div>
      ) : showEmptyHero ? (
        <EmptyState
          ackedCount={counts.acked}
          lastResolved={
            filteredAcked[0]?.ackedAt ?? null
          }
        />
      ) : filteredActive.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-6 text-sm text-[var(--color-text-secondary)]">
          <CheckCircle2
            aria-hidden
            className="h-4 w-4 text-[var(--color-success)]"
          />
          No hay alertas en este filtro.
        </div>
      ) : (
        <section aria-label="Alertas activas">
          <header className="mb-2 flex items-baseline justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Activas
              <span className="ml-1 tabular-nums text-[var(--color-text-secondary)]">
                ({filteredActive.length})
              </span>
            </h2>
          </header>
          <ul className="flex flex-col gap-2">
            {filteredActive.map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                onAck={() => handleAck(a)}
                onUnack={() => handleUnack(a)}
                busy={
                  (ackMutation.isPending &&
                    ackMutation.variables?.id === a.id) ||
                  (unackMutation.isPending &&
                    unackMutation.variables?.id === a.id)
                }
              />
            ))}
          </ul>
        </section>
      )}

      {/* Sección secundaria colapsable — solo para "Sin atender" porque en
          "Todas" los atendidos ya aparecen integrados en la lista principal. */}
      {filter === "active" && filteredAcked.length > 0 ? (
        <details
          open={showAcked}
          onToggle={(e) =>
            setShowAcked((e.currentTarget as HTMLDetailsElement).open)
          }
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-xs uppercase tracking-wide text-[var(--color-text-muted)] focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-2">
            <span className="flex items-center gap-2">
              Atendidas
              <span className="tabular-nums text-[var(--color-text-secondary)]">
                ({filteredAcked.length})
              </span>
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {showAcked ? "Ocultar" : "Mostrar"}
            </span>
          </summary>
          <ul className="flex flex-col gap-2 border-t border-[var(--color-border)] p-3">
            {filteredAcked.map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                onAck={() => handleAck(a)}
                onUnack={() => handleUnack(a)}
                busy={
                  (ackMutation.isPending &&
                    ackMutation.variables?.id === a.id) ||
                  (unackMutation.isPending &&
                    unackMutation.variables?.id === a.id)
                }
              />
            ))}
          </ul>
        </details>
      ) : null}

      <p className="text-xs text-[var(--color-text-muted)]">
        El estado &quot;atendida&quot; se sincroniza con el backend. Queda
        registrado en auditoría con tu usuario.
      </p>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warning" | "destructive" | "muted";
}) {
  const color =
    tone === "destructive"
      ? "text-[var(--color-destructive)]"
      : tone === "warning"
        ? "text-[var(--color-warning)]"
        : tone === "muted"
          ? "text-[var(--color-text-muted)]"
          : "text-[var(--color-text)]";
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>
        {value}
      </div>
    </div>
  );
}

/**
 * Empty state hero — "Sistema estable" cuando no hay alertas activas.
 *
 * Reemplaza el banner verde plano por algo que enseña la interfaz:
 *   - Icono ShieldCheck grande con opacidad para señalar reposo.
 *   - Copy que explica qué dispara alertas, no genérico.
 *   - Acciones a Bitácora y Configuración para destinos próximos.
 */
function EmptyState({
  ackedCount,
  lastResolved,
}: {
  ackedCount: number;
  lastResolved: string | null;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <ShieldCheck
        aria-hidden
        className="h-8 w-8 text-[var(--color-success)] opacity-60"
      />
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">
          Sistema estable
        </h2>
        <p className="mt-1 max-w-prose text-sm text-[var(--color-text-secondary)]">
          {lastResolved ? (
            <>
              La última alerta crítica se resolvió{" "}
              <time
                dateTime={lastResolved}
                className="text-[var(--color-text)]"
              >
                {formatDateTime(lastResolved)}
              </time>
              .{" "}
            </>
          ) : null}
          Las alertas aparecen aquí cuando el ETL falla, la cuarentena pasa
          de 20 pendientes, o la salud del DWH baja de OK.
        </p>
        {ackedCount > 0 ? (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Hoy se atendieron <span className="tabular-nums">{ackedCount}</span>{" "}
            alerta(s). Quedan en la sección Atendidas para auditoría.
          </p>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/bitacora">Ver bitácora</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/configuracion">Configurar umbrales</Link>
        </Button>
      </div>
    </div>
  );
}

function AlertRow({
  alert,
  onAck,
  onUnack,
  busy,
}: {
  alert: Alert;
  onAck: () => void;
  onUnack: () => void;
  busy: boolean;
}) {
  const looksLikeTable = /^[A-Za-z][A-Za-z0-9_]{3,}$/.test(alert.source);
  const runbookEntry = RUNBOOK.find((r) =>
    r.keywords.some((kw) => alert.message.toLowerCase().includes(kw)),
  );

  return (
    <li
      className={cn(
        "relative flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 transition",
        alert.acknowledged && "opacity-70",
      )}
    >
      <SeverityIcon
        severity={alert.severity}
        className="mt-0.5 h-5 w-5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium text-[var(--color-text)]">
            {alert.source}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {formatDateTime(alert.createdAt)}
          </span>
        </div>
        <p
          className={cn(
            "text-sm",
            severityTextColor[alert.severity],
            "opacity-90",
          )}
        >
          {alert.message}
        </p>
        {(looksLikeTable || runbookEntry) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {looksLikeTable && (
              <Link
                href="/dwh"
                className="inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]"
              >
                <Database aria-hidden className="h-3 w-3" />
                Ver en DWH
              </Link>
            )}
            {runbookEntry && (
              <details className="w-full">
                <summary className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] list-none">
                  <BookOpen aria-hidden className="h-3 w-3" />
                  Acción recomendada
                </summary>
                <p className="mt-1 rounded-md bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                  {runbookEntry.action}
                </p>
              </details>
            )}
          </div>
        )}
        {/* Badge "atendida por" ahora arriba a la derecha (audit P1-B).
            Se ancla absolutamente para no empujar el layout del título. */}
        {alert.acknowledged && alert.ackedBy ? (
          <span
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]"
            title={
              alert.ackedAt
                ? `Atendida ${formatDateTime(alert.ackedAt)}`
                : "Atendida"
            }
          >
            <CircleCheck
              aria-hidden
              className="h-3 w-3 text-[var(--color-success)]"
            />
            <span className="font-mono text-[var(--color-text-secondary)]">
              {alert.ackedBy}
            </span>
            {alert.ackedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>{formatDateTime(alert.ackedAt)}</span>
              </>
            ) : null}
          </span>
        ) : null}
      </div>
      {alert.acknowledged ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onUnack}
          disabled={busy}
          aria-busy={busy}
          className="min-h-[44px]"
        >
          {busy ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          Reabrir
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={onAck}
          disabled={busy}
          aria-busy={busy}
          className="min-h-[44px]"
        >
          {busy ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
          )}
          Marcar atendida
        </Button>
      )}
    </li>
  );
}
