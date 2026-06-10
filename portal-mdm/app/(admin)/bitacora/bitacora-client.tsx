"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  FileSearch,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/charts/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import {
  useBitacoraList,
  useBitacoraResumen,
  type VentanaResumen,
} from "@/hooks/use-bitacora";
import {
  BitacoraEstado,
  type BitacoraEntry,
} from "@/lib/schemas/bitacora";
import { BitacoraStatusBadge } from "@/components/control-center/bitacora-status-badge";
import { BitacoraDetailDrawer } from "@/components/control-center/bitacora-detail-drawer";
import { Pagination } from "@/components/ui/pagination";
import { useUrlState } from "@/hooks/use-url-state";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const ESTADOS_FILTRABLES: ReadonlyArray<BitacoraEstado> = [
  "OK",
  "ERROR",
  "EN_PROCESO",
  "SKIPPED",
  "TIMEOUT",
] as const;

const VENTANAS: ReadonlyArray<{ valor: VentanaResumen; label: string }> = [
  { valor: 1, label: "Hoy" },
  { valor: 7, label: "7 días" },
  { valor: 30, label: "30 días" },
] as const;

type Tab = "por-corrida" | "por-tabla";

export function BitacoraClient() {
  const [urlState, setUrlState] = useUrlState({
    tab: "por-corrida",
    page: 1,
    pageSize: 50,
    tabla: "",
  });

  const tab: Tab = (["por-corrida", "por-tabla"] as Tab[]).includes(urlState.tab as Tab)
    ? (urlState.tab as Tab)
    : "por-corrida";
  const page = urlState.page;
  const pageSize = (PAGE_SIZE_OPTIONS.includes(urlState.pageSize as PageSize)
    ? urlState.pageSize
    : 50) as PageSize;
  const tableQuery = urlState.tabla as string;

  function setTab(t: Tab) { setUrlState({ tab: t }); }
  function setPage(p: number) { setUrlState({ page: p }); }
  function setPageSize(n: number) { setUrlState({ pageSize: n, page: 1 }); }

  const [ventana, setVentana] = useState<VentanaResumen>(7);
  const [estadosSel, setEstadosSel] = useState<Set<BitacoraEstado>>(new Set());
  const [tableInput, setTableInput] = useState(() => tableQuery);
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setUrlState({ tabla: tableInput.trim() || null, page: 1 });
    }, 300);
    return () => clearTimeout(t);
  }, [tableInput, setUrlState]);

  const resumen = useBitacoraResumen(ventana);
  const list = useBitacoraList({
    pagina: page,
    tamano: pageSize,
    estado: estadosSel.size > 0 ? Array.from(estadosSel) : null,
    tabla: tableQuery || null,
  });

  const items = useMemo<BitacoraEntry[]>(
    () => list.data?.items ?? [],
    [list.data],
  );
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filtrosActivos =
    estadosSel.size > 0 || tableQuery.length > 0;

  function toggleEstado(e: BitacoraEstado) {
    setEstadosSel((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
    setPage(1);
  }

  function clearFilters() {
    setEstadosSel(new Set());
    setTableInput("");
    setTableInput("");
    setUrlState({ tabla: null, page: 1 });
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bitácora"
        description="Historial detallado de cargas ETL: corridas, métricas y errores con trazabilidad."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => list.refetch()}
            aria-label="Refrescar"
            className="gap-1.5"
          >
            <RefreshCw
              aria-hidden
              className={cn("h-4 w-4", list.isFetching && "animate-spin")}
            />
            Refrescar
          </Button>
        }
      />

      {/* Resumen KPIs por ventana */}
      <section
        aria-label={`Resumen ${VENTANAS.find((v) => v.valor === ventana)?.label}`}
        className="flex flex-col gap-3"
      >
        <VentanaSwitcher value={ventana} onChange={setVentana} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Tasa de éxito"
            value={
              resumen.data
                ? formatPercent(resumen.data.tasaExitoPct)
                : "—"
            }
            icon={CheckCircle2}
            tone={
              !resumen.data
                ? "default"
                : resumen.data.tasaExitoPct >= 95
                  ? "success"
                  : resumen.data.tasaExitoPct >= 80
                    ? "warning"
                    : "destructive"
            }
          />
          <KpiCard
            label="Cargas totales"
            value={resumen.data ? formatNumber(resumen.data.total) : "—"}
            icon={Activity}
            tone="info"
          />
          <KpiCard
            label="Filas insertadas"
            value={resumen.data ? formatNumber(resumen.data.filasOk) : "—"}
            icon={Database}
            tone="default"
          />
          <KpiCard
            label="Errores"
            value={resumen.data ? formatNumber(resumen.data.errores) : "—"}
            icon={ShieldAlert}
            tone={
              !resumen.data
                ? "default"
                : resumen.data.errores > 0
                  ? "destructive"
                  : "success"
            }
          />
        </div>
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
        <TabButton
          active={tab === "por-corrida"}
          onClick={() => setTab("por-corrida")}
        >
          Por corrida
        </TabButton>
        <TabButton
          active={tab === "por-tabla"}
          onClick={() => setTab("por-tabla")}
        >
          Por tabla
        </TabButton>
      </div>

      {/* Toolbar de filtros */}
      <section
        aria-label="Filtros"
        className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <Input
              value={tableInput}
              onChange={(e) => setTableInput(e.target.value)}
              placeholder="Filtrar por tabla destino…"
              aria-label="Filtrar por tabla destino"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <Filter aria-hidden className="h-3.5 w-3.5" />
              Estado
            </span>
            {ESTADOS_FILTRABLES.map((e) => (
              <EstadoChip
                key={e}
                estado={e}
                active={estadosSel.has(e)}
                onClick={() => toggleEstado(e)}
              />
            ))}
          </div>
          {filtrosActivos ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1.5"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
              Limpiar
            </Button>
          ) : null}
        </div>
      </section>

      {/* Contenido */}
      {list.isError ? (
        <ErrorBlock
          message={
            list.error instanceof Error
              ? list.error.message
              : "Error al cargar la bitácora"
          }
          onRetry={() => list.refetch()}
        />
      ) : list.isLoading ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <EmptyState filtrosActivos={filtrosActivos} onClear={clearFilters} />
      ) : tab === "por-corrida" ? (
        <PorCorridaTable items={items} onOpen={setDetailId} />
      ) : (
        <PorTablaTable items={items} onOpen={setDetailId} />
      )}

      {/* Footer paginación */}
      {!list.isLoading && items.length > 0 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      ) : null}

      <BitacoraDetailDrawer
        idLog={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Subcomponentes                                                             */
/* -------------------------------------------------------------------------- */

function VentanaSwitcher({
  value,
  onChange,
}: {
  value: VentanaResumen;
  onChange: (v: VentanaResumen) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Ventana de resumen"
      className="inline-flex w-fit items-center gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
    >
      {VENTANAS.map((v) => (
        <button
          key={v.valor}
          type="button"
          role="radio"
          aria-checked={value === v.valor}
          onClick={() => onChange(v.valor)}
          className={cn(
            "min-h-[34px] rounded px-3 text-xs font-medium transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
            value === v.valor
              ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "min-h-[40px] px-4 text-sm font-medium transition focus-visible:outline-none",
        active
          ? "border-b-2 border-[var(--color-primary)] text-[var(--color-text)]"
          : "border-b-2 border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
      )}
    >
      {children}
    </button>
  );
}

const ESTADO_STYLE: Record<BitacoraEstado, { activeClass: string; dot: string }> = {
  OK: {
    activeClass:
      "border-[var(--color-success)] bg-[color-mix(in_oklab,var(--color-success)_15%,transparent)] text-[var(--color-success)]",
    dot: "bg-[var(--color-success)]",
  },
  ERROR: {
    activeClass:
      "border-[var(--color-destructive)] bg-[color-mix(in_oklab,var(--color-destructive)_15%,transparent)] text-[var(--color-destructive)]",
    dot: "bg-[var(--color-destructive)]",
  },
  EN_PROCESO: {
    activeClass:
      "border-[var(--color-primary)] bg-[color-mix(in_oklab,var(--color-primary)_15%,transparent)] text-[var(--color-text)]",
    dot: "bg-[var(--color-primary)]",
  },
  SKIPPED: {
    activeClass:
      "border-[var(--color-text-muted)] bg-[color-mix(in_oklab,var(--color-text-muted)_10%,transparent)] text-[var(--color-text-muted)]",
    dot: "bg-[var(--color-text-muted)]",
  },
  TIMEOUT: {
    activeClass:
      "border-[var(--color-warning)] bg-[color-mix(in_oklab,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]",
    dot: "bg-[var(--color-warning)]",
  },
};

function EstadoChip({
  estado,
  active,
  onClick,
}: {
  estado: BitacoraEstado;
  active: boolean;
  onClick: () => void;
}) {
  const label = (
    {
      OK: "OK",
      ERROR: "Error",
      EN_PROCESO: "En proceso",
      SKIPPED: "Omitido",
      TIMEOUT: "Timeout",
    } as const
  )[estado];
  const { activeClass, dot } = ESTADO_STYLE[estado];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-[28px] items-center rounded-full border px-2.5 text-[11px] font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
        active
          ? activeClass
          : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]",
      )}
    >
      <span
        className={cn("inline-block h-1.5 w-1.5 rounded-full mr-1", dot, active ? "opacity-100" : "opacity-40")}
        aria-hidden
      />
      {label}
    </button>
  );
}

/* -------------------------------- Tablas -------------------------------- */

interface TableProps {
  items: BitacoraEntry[];
  onOpen: (idLog: number) => void;
}

/** Vista "Por corrida": agrupa por idCorrida (o "Sin corrida" si null). */
function PorCorridaTable({ items, onOpen }: TableProps) {
  const groups = useMemo(() => {
    const map = new Map<string, BitacoraEntry[]>();
    for (const it of items) {
      const k = it.idCorrida ?? "__sin_corrida__";
      const arr = map.get(k);
      if (arr) arr.push(it);
      else map.set(k, [it]);
    }
    return Array.from(map.entries()).map(([key, entries]) => ({ key, entries }));
  }, [items]);

  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => (
        <CorridaGroup
          key={g.key}
          idCorrida={g.key === "__sin_corrida__" ? null : g.key}
          entries={g.entries}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function CorridaGroup({
  idCorrida,
  entries,
  onOpen,
}: {
  idCorrida: string | null;
  entries: BitacoraEntry[];
  onOpen: (id: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const ok = entries.filter((e) => e.estado === "OK").length;
  const err = entries.filter((e) => e.estado === "ERROR").length;
  const running = entries.filter((e) => e.estado === "EN_PROCESO").length;
  const totalFilas = entries.reduce((acc, e) => acc + e.filasInsertadas, 0);
  const fechaInicio = entries
    .map((e) => e.fechaInicio)
    .filter((v): v is string => Boolean(v))
    .sort()[0];

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-3 px-3 py-2.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
        )}
      >
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition",
            !open && "-rotate-90",
          )}
        />
        <div className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            Corrida
          </span>
          <span className="font-mono text-sm font-medium text-[var(--color-text)]">
            {idCorrida ?? "sin asociar"}
          </span>
          {fechaInicio ? (
            <span className="text-xs text-[var(--color-text-muted)]">
              {formatDateTime(fechaInicio)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-[var(--color-surface-2)] px-2 py-0.5 tabular-nums text-[var(--color-text-secondary)]">
            {entries.length} {entries.length === 1 ? "tabla" : "tablas"}
          </span>
          {ok > 0 ? (
            <span className="text-[var(--color-success)] tabular-nums">
              {ok} OK
            </span>
          ) : null}
          {running > 0 ? (
            <span className="text-[var(--color-info)] tabular-nums">
              {running} activas
            </span>
          ) : null}
          {err > 0 ? (
            <span className="text-[var(--color-destructive)] tabular-nums">
              {err} ERROR
            </span>
          ) : null}
          <span className="text-[var(--color-text-muted)] tabular-nums">
            {formatNumber(totalFilas)} filas
          </span>
        </div>
      </summary>
      <div className="border-t border-[var(--color-border)]">
        <PorTablaTable items={entries} onOpen={onOpen} embedded />
      </div>
    </details>
  );
}

function PorTablaTable({
  items,
  onOpen,
  embedded,
}: TableProps & { embedded?: boolean }) {
  return (
    <div
      className={cn(
        "overflow-x-auto",
        !embedded &&
          "rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]",
      )}
    >
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">Tabla</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 text-right font-medium">Filas OK</th>
            <th className="px-3 py-2 text-right font-medium">Rechazadas</th>
            <th className="px-3 py-2 font-medium">Inicio</th>
            <th className="px-3 py-2 text-right font-medium">Duración</th>
            <th className="px-3 py-2 font-medium">Proceso</th>
            <th className="px-3 py-2 sr-only">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr
              key={it.idLog}
              className="border-t border-[var(--color-border)] transition hover:bg-[var(--color-surface-2)]/60"
            >
              <td className="px-3 py-2 font-mono text-[13px]">{it.tablaDestino}</td>
              <td className="px-3 py-2">
                <BitacoraStatusBadge estado={it.estado} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatNumber(it.filasInsertadas)}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-right tabular-nums",
                  it.filasRechazadas > 0
                    ? "text-[var(--color-destructive)]"
                    : "text-[var(--color-text-muted)]",
                )}
              >
                {formatNumber(it.filasRechazadas)}
              </td>
              <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                {it.fechaInicio ? formatDateTime(it.fechaInicio) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                {fmtDur(it.duracionSegundos)}
              </td>
              <td
                className="max-w-[180px] truncate px-3 py-2 text-xs text-[var(--color-text-muted)]"
                title={it.nombreProceso}
              >
                {it.nombreProceso}
              </td>
              <td className="px-3 py-2 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpen(it.idLog)}
                  className="h-7 gap-1 px-2 text-xs"
                  aria-label={`Ver detalle del log ${it.idLog}`}
                >
                  Detalle
                  <ChevronRight aria-hidden className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtDur(seg: number | null): string {
  if (seg == null) return "—";
  if (seg < 60) return `${seg}s`;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/* ----------------------------- Estados UI ----------------------------- */

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

function EmptyState({
  filtrosActivos,
  onClear,
}: {
  filtrosActivos: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-14 text-center">
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
      >
        <FileSearch className="h-6 w-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[var(--color-text)]">
          {filtrosActivos
            ? "Sin resultados para los filtros aplicados"
            : "No hay cargas registradas todavía"}
        </p>
        <p className="max-w-sm text-xs text-[var(--color-text-muted)]">
          {filtrosActivos
            ? "Prueba quitando algún filtro o ampliando la búsqueda por tabla."
            : "Cuando el ETL ejecute por primera vez verás aquí cada tabla cargada y su estado."}
        </p>
      </div>
      {filtrosActivos ? (
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1.5">
          <X aria-hidden className="h-3.5 w-3.5" />
          Limpiar filtros
        </Button>
      ) : null}
    </div>
  );
}

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-md border border-[var(--color-destructive)]/40 bg-[color-mix(in_oklab,var(--color-destructive)_8%,transparent)] px-4 py-4 text-sm text-[var(--color-destructive)]"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRetry}
        className="w-fit gap-1.5"
      >
        <RefreshCw aria-hidden className="h-3.5 w-3.5" />
        Reintentar
      </Button>
    </div>
  );
}

/* ----------------------------- Paginación ----------------------------- */

