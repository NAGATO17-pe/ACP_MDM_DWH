/**
 * components/ui/page-skeleton.tsx
 * ================================
 * Reemplazo unificado para los 11+ archivos `loading.tsx` del App Router.
 * Antes cada ruta replicaba el mismo grid de Skeleton con pequeñas
 * variaciones; este componente expone templates nombradas.
 *
 * Uso:
 *   // app/(admin)/quality/loading.tsx
 *   export default function Loading() {
 *     return <PageSkeleton template="dashboard-with-table" kpiCount={4} />;
 *   }
 */

import { KpiSkeleton, Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export type PageSkeletonTemplate =
  | "header-only"
  | "kpi-grid"
  | "dashboard"             // header + 4 KPI + 6 cards
  | "dashboard-with-table"  // header + 4 KPI + filtros + tabla
  | "table"                 // header + filtros + tabla
  | "detail"                // header + 2 col detalle
  | "alerts";               // header + 4 KPI compactos + lista

interface PageSkeletonProps {
  template?: PageSkeletonTemplate;
  kpiCount?: number;
  tableRows?: number;
  cardCount?: number;
}

function HeaderSk() {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80" />
    </div>
  );
}

function KpiRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <KpiSkeleton key={i} />
      ))}
    </div>
  );
}

function CardsGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-56 rounded-lg" />
      ))}
    </div>
  );
}

function FiltersBar() {
  return (
    <div className="flex items-center justify-between gap-2">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-8 w-40" />
    </div>
  );
}

export function PageSkeleton({
  template = "dashboard",
  kpiCount = 4,
  tableRows = 8,
  cardCount = 6,
}: PageSkeletonProps) {
  switch (template) {
    case "header-only":
      return (
        <div className="flex flex-col gap-6">
          <HeaderSk />
        </div>
      );
    case "kpi-grid":
      return (
        <div className="flex flex-col gap-6">
          <HeaderSk />
          <KpiRow count={kpiCount} />
        </div>
      );
    case "dashboard":
      return (
        <div className="flex flex-col gap-6">
          <HeaderSk />
          <KpiRow count={kpiCount} />
          <CardsGrid count={cardCount} />
        </div>
      );
    case "dashboard-with-table":
      return (
        <div className="flex flex-col gap-6">
          <HeaderSk />
          <KpiRow count={kpiCount} />
          <FiltersBar />
          <TableSkeleton rows={tableRows} />
        </div>
      );
    case "table":
      return (
        <div className="flex flex-col gap-6">
          <HeaderSk />
          <FiltersBar />
          <TableSkeleton rows={tableRows} />
        </div>
      );
    case "detail":
      return (
        <div className="flex flex-col gap-6">
          <HeaderSk />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-72 rounded-lg lg:col-span-2" />
            <Skeleton className="h-72 rounded-lg" />
          </div>
        </div>
      );
    case "alerts":
      return (
        <div className="flex flex-col gap-6">
          <HeaderSk />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-md" />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-md" />
            ))}
          </div>
        </div>
      );
  }
}
