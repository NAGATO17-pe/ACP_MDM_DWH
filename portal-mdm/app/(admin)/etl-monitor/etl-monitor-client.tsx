"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useUrlState } from "@/hooks/use-url-state";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  History,
  Inbox,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table/data-table";
import { EtlStatusBadge } from "@/components/control-center/etl-status-badge";
import { ActiveRunCard } from "@/components/control-center/active-run-card";
import {
  useActiveCorridas,
  useEtlRuns,
} from "@/hooks/use-control-center";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EtlRun } from "@/lib/schemas/control-center";

function isHttpError(e: unknown): e is Error & { status: number } {
  return (
    e instanceof Error &&
    typeof (e as Error & { status?: unknown }).status === "number"
  );
}

const LIMIT_OPTIONS = [25, 50, 100] as const;
type Tab = "live" | "history";

export function EtlMonitorClient() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tabParam = search.get("tab");
  const tab: Tab = tabParam === "history" ? "history" : "live";

  const setTab = (next: Tab) => {
    const sp = new URLSearchParams(search.toString());
    if (next === "live") sp.delete("tab");
    else sp.set("tab", next);
    const qs = sp.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  // Pausa el historial cuando estás en "En vivo" para reducir requests;
  // se rehidrata al cambiar de pestaña sin perder caché.
  const activeQuery = useActiveCorridas();
  const liveCount = activeQuery.data?.length ?? 0;

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as Tab)}
      className="flex flex-col gap-4"
    >
      <TabsList className="self-start">
        <TabsTrigger value="live" className="gap-1.5">
          <Activity aria-hidden className="h-3.5 w-3.5" />
          En vivo
          {liveCount > 0 ? (
            <span
              aria-label={`${liveCount} corridas activas`}
              className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--color-primary-foreground)]"
            >
              {liveCount}
            </span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-1.5">
          <History aria-hidden className="h-3.5 w-3.5" />
          Historial
        </TabsTrigger>
      </TabsList>

      <TabsContent value="live" className="mt-0">
        <LiveTab />
      </TabsContent>

      <TabsContent value="history" className="mt-0">
        <HistoryTab />
      </TabsContent>
    </Tabs>
  );
}

/* ── Tab: En vivo ────────────────────────────────────────────────────────── */

function LiveTab() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isFetching } =
    useActiveCorridas();

  return (
    <section aria-label="Corridas ETL en curso" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span
            aria-hidden
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              isFetching
                ? "bg-[var(--color-primary)] animate-pulse"
                : "bg-[var(--color-success)]",
            )}
          />
          <span>
            {isFetching ? "Sincronizando…" : "Actualizando cada 5 segundos"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          aria-label="Refrescar corridas activas"
        >
          <RefreshCw
            aria-hidden
            className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
          />
          Refrescar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        (() => {
          if (isHttpError(error) && error.status === 401) {
            router.push("/login");
            return null;
          }
          return (
            <ErrorPanel
              message={
                error instanceof Error
                  ? error.message
                  : "No se pudo cargar el estado en vivo."
              }
              onRetry={() => refetch()}
            />
          );
        })()
      ) : !data || data.length === 0 ? (
        <EmptyLive />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {data.map((c) => (
            <ActiveRunCard key={c.id} corrida={c} />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyLive() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-6 py-12 text-center"
    >
      <span
        aria-hidden
        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
      >
        <Inbox className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold text-[var(--color-text)]">
        Sin corridas en curso
      </p>
      <p className="max-w-md text-xs text-[var(--color-text-muted)]">
        Cuando un fact se esté ejecutando aparecerá aquí con su pipeline en
        tiempo real y heartbeat del runner.
      </p>
      <Button asChild variant="primary" size="sm" className="mt-2">
        <Link href="/etl-monitor/lanzar">Lanzar una corrida</Link>
      </Button>
    </div>
  );
}

/* ── Tab: Historial ──────────────────────────────────────────────────────── */

function HistoryTab() {
  const [{ limit: rawLimit }, setUrlState] = useUrlState({ limit: 50 });
  const limit: (typeof LIMIT_OPTIONS)[number] = (
    LIMIT_OPTIONS as readonly number[]
  ).includes(rawLimit)
    ? (rawLimit as (typeof LIMIT_OPTIONS)[number])
    : 50;

  function setLimit(n: (typeof LIMIT_OPTIONS)[number]) {
    setUrlState({ limit: n });
  }

  const { data, isLoading, isError, error, refetch, isFetching } =
    useEtlRuns(limit);

  const columns = useMemo<ColumnDef<EtlRun, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Proceso",
        cell: ({ row }) => (
          <span className="font-medium text-[var(--color-text)]">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: "table",
        header: "Tabla destino",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[var(--color-text-secondary)]">
            {row.original.table ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => <EtlStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "startedAt",
        header: "Inicio",
        cell: ({ row }) =>
          row.original.startedAt ? (
            <span className="tabular-nums text-xs">
              {formatDateTime(row.original.startedAt)}
            </span>
          ) : (
            <span className="text-[var(--color-text-muted)]">—</span>
          ),
      },
      {
        accessorKey: "durationSec",
        header: "Duración",
        cell: ({ row }) => <DurationCell sec={row.original.durationSec} />,
      },
      {
        accessorKey: "rowsProcessed",
        header: "Filas OK",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.rowsProcessed != null
              ? formatNumber(row.original.rowsProcessed)
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "rowsRejected",
        header: "Rechazadas",
        cell: ({ row }) => (
          <span
            className={cn(
              "tabular-nums text-xs",
              (row.original.rowsRejected ?? 0) > 0 &&
                "text-[var(--color-warning)] font-medium",
            )}
          >
            {row.original.rowsRejected != null
              ? formatNumber(row.original.rowsRejected)
              : "—"}
          </span>
        ),
      },
      {
        id: "error",
        header: "",
        cell: ({ row }) =>
          row.original.error ? <ErrorPill message={row.original.error} /> : null,
      },
      {
        id: "retry",
        header: "",
        cell: ({ row }) =>
          row.original.status === "failed" && row.original.table ? (
            <Link
              href={`/etl-monitor/lanzar?fact=${encodeURIComponent(row.original.table)}`}
              aria-label={`Relanzar ${row.original.name}`}
              className="inline-flex items-center gap-0.5 text-xs text-[var(--color-warning)] hover:underline"
            >
              <RotateCcw aria-hidden className="h-3 w-3" />
              Relanzar
            </Link>
          ) : null,
      },
      {
        id: "detail",
        header: "",
        cell: ({ row }) =>
          row.original.corridaId ? (
            <Link
              href={`/etl-monitor/${row.original.corridaId}`}
              aria-label={`Ver detalle de ${row.original.name}`}
              className="inline-flex items-center gap-0.5 text-xs text-[var(--color-primary)] hover:underline"
            >
              Detalle
              <ChevronRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span
              className="text-xs text-[var(--color-text-muted)]"
              title="Sin corrida del control-plane asociada"
            >
              —
            </span>
          ),
      },
    ],
    [],
  );

  return (
    <section aria-label="Historial de corridas" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>Mostrar últimas</span>
          <div
            role="group"
            aria-label="Cantidad de corridas a mostrar"
            className="flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]"
          >
            {LIMIT_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                aria-pressed={limit === n}
                className={cn(
                  "px-2.5 py-1 text-xs tabular-nums transition",
                  limit === n
                    ? "bg-[var(--color-primary-solid)] text-[var(--color-primary-foreground)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          {isFetching ? (
            <span className="flex items-center gap-1">
              <RefreshCw aria-hidden className="h-3 w-3 animate-spin" />
              Refrescando…
            </span>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          aria-label="Refrescar historial"
        >
          <RefreshCw aria-hidden className="h-3.5 w-3.5" />
          Refrescar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 rounded-md" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorPanel
          message={
            error instanceof Error
              ? error.message
              : "El backend no respondió."
          }
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchKey="name"
          searchPlaceholder="Buscar proceso…"
          emptyMessage="Sin corridas en el rango seleccionado"
        />
      )}
    </section>
  );
}

/* ── Shared sub-components ───────────────────────────────────────────────── */

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--color-destructive)_40%,transparent)] bg-[var(--color-surface-2)] p-4 text-sm"
    >
      <div className="flex items-center gap-2 text-[var(--color-destructive)]">
        <AlertTriangle aria-hidden className="h-4 w-4" />
        <span className="font-medium">No se pudo cargar</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw aria-hidden className="h-3.5 w-3.5" />
        Reintentar
      </Button>
    </div>
  );
}

function DurationCell({ sec }: { sec: number | null }) {
  if (sec == null)
    return <span className="text-[var(--color-text-muted)]">—</span>;
  if (sec < 60) return <span className="tabular-nums text-xs">{sec}s</span>;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return (
    <span className="tabular-nums text-xs">
      {m}m {s.toString().padStart(2, "0")}s
    </span>
  );
}

function ErrorPill({ message }: { message: string }) {
  return (
    <span
      title={message}
      className="inline-flex max-w-[180px] items-center gap-1 rounded border border-[color-mix(in_oklab,var(--color-destructive)_30%,transparent)] bg-[color-mix(in_oklab,var(--color-destructive)_10%,transparent)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-destructive)]"
    >
      <AlertTriangle aria-hidden className="h-3 w-3" />
      <span className="truncate">Ver error</span>
    </span>
  );
}
