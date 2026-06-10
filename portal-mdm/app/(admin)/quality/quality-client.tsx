"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileWarning,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/charts/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useQualityKpis } from "@/hooks/use-control-center";
import { useQuarantineList } from "@/hooks/use-quality";
import type { QuarantineRecord } from "@/lib/schemas/quality";
import { QuarantineDrawer } from "@/components/control-center/quarantine-drawer";
import { QuarantineBulkBar } from "@/components/control-center/quarantine-bulk-bar";
import { QuarantineEmptyState } from "@/components/control-center/quarantine-empty-state";
import { Pagination } from "@/components/ui/pagination";
import { useUrlState } from "@/hooks/use-url-state";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function QualityClient() {
  // URL-synced state: page, pageSize y tabla (debounced).
  // La tabla en la URL es el valor ya debounced que va al backend.
  const [urlState, setUrlState] = useUrlState({ page: 1, pageSize: 25, tabla: "" });
  const page = urlState.page;
  const pageSize = (PAGE_SIZE_OPTIONS.includes(urlState.pageSize as PageSize)
    ? urlState.pageSize
    : 25) as PageSize;
  const tabla = urlState.tabla as string;

  // Input local que se debouncea antes de tocar la URL/backend.
  const [inputValue, setInputValue] = useState(() => tabla);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeRecord, setActiveRecord] = useState<QuarantineRecord | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setUrlState({ tabla: inputValue.trim() || null, page: 1 });
      setSelectedIds(new Set());
    }, 300);
    return () => clearTimeout(t);
  }, [inputValue, setUrlState]);

  function setPage(p: number) {
    setUrlState({ page: p });
    setSelectedIds(new Set());
  }
  function setPageSize(n: PageSize) {
    setUrlState({ pageSize: n, page: 1 });
    setSelectedIds(new Set());
  }

  const kpis = useQualityKpis();
  const list = useQuarantineList({
    pagina: page,
    tamano: pageSize,
    tabla: tabla || null,
  });

  const rows = useMemo<QuarantineRecord[]>(
    () => list.data?.datos ?? [],
    [list.data],
  );
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rowKey = (r: QuarantineRecord) => `${r.tablaOrigen}::${r.idRegistro}`;
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(rowKey(r))),
    [rows, selectedIds],
  );
  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(rowKey(r)));

  function togglePage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        rows.forEach((r) => next.delete(rowKey(r)));
      } else {
        rows.forEach((r) => next.add(rowKey(r)));
      }
      return next;
    });
  }

  function toggleRow(r: QuarantineRecord) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const k = rowKey(r);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calidad de Datos"
        description="Cuarentena MDM · revisa y resuelve registros que no pasaron las reglas de validación."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              kpis.refetch();
              list.refetch();
            }}
            aria-label="Refrescar"
          >
            <RefreshCw
              aria-hidden
              className={cn("h-3.5 w-3.5", list.isFetching && "animate-spin")}
            />
            Refrescar
          </Button>
        }
      />

      <QualityKpiStrip
        loading={kpis.isLoading}
        error={kpis.isError}
        data={kpis.data}
      />

      <section
        aria-label="Listado de cuarentena"
        className="flex flex-col gap-3"
      >
        <Toolbar
          tableFilter={inputValue}
          onTableFilterChange={setInputValue}
          pageSize={pageSize}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
            setSelectedIds(new Set());
          }}
          totalCount={total}
          isFetching={list.isFetching}
        />

        <QuarantineBulkBar
          selected={selectedRows}
          onClear={() => setSelectedIds(new Set())}
        />

        {list.isLoading ? (
          <TableSkeleton />
        ) : list.isError || !list.data ? (
          <TableError
            message={
              list.error instanceof Error
                ? list.error.message
                : "No se pudo cargar la cuarentena."
            }
            onRetry={() => list.refetch()}
          />
        ) : rows.length === 0 ? (
          <QuarantineEmptyState filtered={Boolean(tabla)} />
        ) : (
          <>
            <QuarantineTable
              rows={rows}
              rowKey={rowKey}
              selectedIds={selectedIds}
              allOnPageSelected={allOnPageSelected}
              onTogglePage={togglePage}
              onToggleRow={toggleRow}
              onOpenDetail={setActiveRecord}
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              rowsThisPage={rows.length}
              onPage={setPage}
            />
          </>
        )}
      </section>

      <QuarantineDrawer
        record={activeRecord}
        onClose={() => setActiveRecord(null)}
      />
    </div>
  );
}

/* ── KPI strip ───────────────────────────────────────────────────────────── */

interface QualityKpiStripProps {
  loading: boolean;
  error: boolean;
  data:
    | {
        total: number;
        pendientes: number;
        resueltos: number;
        descartados: number;
        resolutionRate: number;
      }
    | undefined;
}

function QualityKpiStrip({ loading, error, data }: QualityKpiStripProps) {
  if (loading) {
    return (
      <section
        aria-label="KPIs de calidad"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-md" />
        ))}
      </section>
    );
  }

  if (error || !data) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-md border border-[var(--color-destructive)]/40 bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-destructive)]"
      >
        <AlertTriangle aria-hidden className="h-4 w-4" />
        No se pudo cargar el resumen de cuarentena.
      </div>
    );
  }

  return (
    <section
      aria-label="KPIs de calidad"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <KpiCard
        label="Total cuarentena"
        value={formatNumber(data.total)}
        icon={ShieldAlert}
        tone="default"
      />
      <KpiCard
        label="Pendientes"
        value={formatNumber(data.pendientes)}
        icon={Clock}
        tone={data.pendientes > 0 ? "warning" : "success"}
      />
      <KpiCard
        label="Resueltos"
        value={formatNumber(data.resueltos)}
        icon={CheckCircle2}
        tone="success"
      />
      <KpiCard
        label="Descartados"
        value={formatNumber(data.descartados)}
        icon={XCircle}
        tone="destructive"
      />
    </section>
  );
}

/* ── Toolbar ─────────────────────────────────────────────────────────────── */

interface ToolbarProps {
  tableFilter: string;
  onTableFilterChange: (v: string) => void;
  pageSize: PageSize;
  onPageSizeChange: (n: PageSize) => void;
  totalCount: number;
  isFetching: boolean;
}

function Toolbar({
  tableFilter,
  onTableFilterChange,
  pageSize,
  onPageSizeChange,
  totalCount,
  isFetching,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative w-full max-w-xs">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <Input
          aria-label="Filtrar por tabla origen"
          placeholder="Filtrar por tabla origen…"
          className="pl-9"
          value={tableFilter}
          onChange={(e) => onTableFilterChange(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span className="tabular-nums">
          {formatNumber(totalCount)} pendientes
        </span>
        <div
          role="group"
          aria-label="Tamaño de página"
          className="flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPageSizeChange(n)}
              aria-pressed={pageSize === n}
              className={cn(
                "px-2.5 py-1 text-xs tabular-nums transition",
                pageSize === n
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
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
    </div>
  );
}

/* ── Tabla ───────────────────────────────────────────────────────────────── */

interface QuarantineTableProps {
  rows: QuarantineRecord[];
  rowKey: (r: QuarantineRecord) => string;
  selectedIds: Set<string>;
  allOnPageSelected: boolean;
  onTogglePage: () => void;
  onToggleRow: (r: QuarantineRecord) => void;
  onOpenDetail: (r: QuarantineRecord) => void;
}

function QuarantineTable({
  rows,
  rowKey,
  selectedIds,
  allOnPageSelected,
  onTogglePage,
  onToggleRow,
  onOpenDetail,
}: QuarantineTableProps) {
  return (
    <div className="bg-surface overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          <tr className="border-b border-[var(--color-border)]">
            <th scope="col" className="w-10 px-3 py-3">
              <SelectAllCheckbox
                checked={allOnPageSelected}
                onChange={onTogglePage}
                count={rows.length}
              />
              {/* aria label provided inside component */}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Tabla
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Columna
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Valor recibido
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Motivo
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Ingresado
            </th>
            <th scope="col" className="w-10 px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const key = rowKey(r);
            const checked = selectedIds.has(key);
            return (
              <tr
                key={key}
                className={cn(
                  "border-b border-[var(--color-border)] transition-colors",
                  idx % 2 === 1 && "bg-[var(--color-surface-2)]/30",
                  checked
                    ? "bg-[color-mix(in_oklab,var(--color-primary)_8%,transparent)]"
                    : "hover:bg-[var(--color-surface-2)]",
                )}
              >
                <td className="px-3 py-3">
                  <RowCheckbox
                    checked={checked}
                    onChange={() => onToggleRow(r)}
                    label={`Seleccionar registro ${r.idRegistro}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-[var(--color-text)]">
                    {r.tablaOrigen}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                    {r.columnaOrigen}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ValueCell value={r.valorRaw} />
                </td>
                <td className="px-4 py-3">
                  <MotivoCell motivo={r.motivo} />
                </td>
                <td className="px-4 py-3">
                  {r.fechaIngreso ? (
                    <span className="tabular-nums text-xs text-[var(--color-text-muted)]">
                      {formatDateTime(r.fechaIngreso)}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(r)}
                    aria-label={`Abrir detalle del registro ${r.idRegistro}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                  >
                    <ChevronRight aria-hidden className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ValueCell({ value }: { value: string }) {
  const display = value === "" ? "(vacío)" : value;
  const empty = value === "";
  return (
    <span
      title={display}
      className={cn(
        "block max-w-[220px] truncate font-mono text-xs",
        empty
          ? "italic text-[var(--color-text-muted)]"
          : "text-[var(--color-destructive)]",
      )}
    >
      {display}
    </span>
  );
}

function MotivoCell({ motivo }: { motivo: string | null }) {
  if (!motivo) {
    return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
  }
  return (
    <span
      title={motivo}
      className="flex max-w-[280px] items-center gap-1.5 text-xs text-[var(--color-text-secondary)]"
    >
      <FileWarning
        aria-hidden
        className="h-3.5 w-3.5 shrink-0 text-[var(--color-warning)]"
      />
      <span className="truncate">{motivo}</span>
    </span>
  );
}

/* ── Checkboxes ──────────────────────────────────────────────────────────── */

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

function RowCheckbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center">
      <span className="sr-only">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 cursor-pointer accent-[var(--color-primary)]"
      />
    </label>
  );
}

interface SelectAllProps {
  checked: boolean;
  onChange: () => void;
  count: number;
}

function SelectAllCheckbox({ checked, onChange, count }: SelectAllProps) {
  return (
    <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center">
      <span className="sr-only">
        {checked
          ? `Deseleccionar los ${count} registros visibles`
          : `Seleccionar los ${count} registros visibles`}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={count === 0}
        aria-label="Seleccionar todos"
        className="h-4 w-4 cursor-pointer accent-[var(--color-primary)] disabled:cursor-not-allowed"
      />
    </label>
  );
}

/* ── Skeletons / Error ───────────────────────────────────────────────────── */

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-10 rounded-md" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-md" />
      ))}
    </div>
  );
}

interface TableErrorProps {
  message: string;
  onRetry: () => void;
}

function TableError({ message, onRetry }: TableErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-md border border-[var(--color-destructive)]/40 bg-[var(--color-surface-2)] p-4 text-sm"
    >
      <div className="flex items-center gap-2 text-[var(--color-destructive)]">
        <AlertTriangle aria-hidden className="h-4 w-4" />
        <span className="font-medium">No se pudo cargar la cuarentena</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw aria-hidden className="h-3.5 w-3.5" />
        Reintentar
      </Button>
    </div>
  );
}

