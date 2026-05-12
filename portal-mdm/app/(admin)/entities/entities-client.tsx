"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EntityTable } from "@/components/entities/entity-table";
import { getEntities } from "@/lib/api/entities";
import { qk } from "@/lib/query-keys";

const PAGE_SIZE = 20;

export function EntitiesClient() {
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useQuery({
    queryKey: qk.entities({ page, size: PAGE_SIZE }),
    queryFn: () => getEntities({ page, size: PAGE_SIZE }),
  });

  const entities = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (isLoading) return <TableSkeleton rows={PAGE_SIZE} />;

  return (
    <div className="flex flex-col gap-4">
      <EntityTable data={entities} />
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
          <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
            Página {page} de {totalPages} · {total} entidades
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Página anterior"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Página siguiente"
            >
              Siguiente
              <ChevronRight aria-hidden className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
