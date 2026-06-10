"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** Si se omite se calcula como min(page * pageSize, total). */
  rowsThisPage?: number;
  /** Si se pasa junto con onPageSize, muestra selector de filas por página. */
  pageSizeOptions?: readonly number[];
  onPage: (p: number) => void;
  onPageSize?: (n: number) => void;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  rowsThisPage,
  pageSizeOptions,
  onPage,
  onPageSize,
  className,
}: PaginationProps) {
  const from = (page - 1) * pageSize + 1;
  const to =
    rowsThisPage != null
      ? (page - 1) * pageSize + rowsThisPage
      : Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Paginación"
      className={cn(
        "flex flex-col items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3 text-xs sm:flex-row",
        className,
      )}
    >
      <p className="tabular-nums text-[var(--color-text-muted)]">
        {formatNumber(from)}–{formatNumber(to)} de {formatNumber(total)}
      </p>

      <div className="flex items-center gap-3">
        {onPageSize && pageSizeOptions && (
          <label className="flex items-center gap-2 text-[var(--color-text-muted)]">
            Filas por página
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              aria-label="Filas por página"
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Página anterior"
            className="h-8 w-8 p-0"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </Button>
          <span className="min-w-[60px] text-center tabular-nums text-[var(--color-text-secondary)]">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="Página siguiente"
            className="h-8 w-8 p-0"
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
