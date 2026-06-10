/**
 * components/layout/page-shell.tsx
 * =================================
 * Wrapper canónico para cualquier página del portal. Reemplaza el
 * `<div className="flex flex-col gap-6"><PageHeader … />…</div>` que se
 * repetía en 14 archivos. Cuando cambie el ritmo vertical, breadcrumbs,
 * o el aria-live de la página, se toca un solo sitio.
 *
 * Mantiene `<PageHeader>` como primitive interna — sigue siendo
 * importable a parte para casos especiales.
 */

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  /** KPIs opcionales — se renderizan entre header y children. */
  kpis?: React.ReactNode;
  /** Anuncia cambio de página a lectores de pantalla. */
  liveLabel?: string;
  className?: string;
  children: React.ReactNode;
}

export function PageShell({
  title,
  description,
  actions,
  breadcrumbs,
  kpis,
  liveLabel,
  className,
  children,
}: PageShellProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {liveLabel ? (
        <span aria-live="polite" className="sr-only">
          {liveLabel}
        </span>
      ) : null}

      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs items={breadcrumbs} />
      ) : null}

      <PageHeader title={title} description={description} actions={actions} />

      {kpis ? <div>{kpis}</div> : null}

      {children}
    </div>
  );
}

function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  return (
    <nav aria-label="Migas de pan" className="-mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--color-text-muted)]">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="rounded px-1 hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    "px-1",
                    last && "text-[var(--color-text-secondary)] font-medium",
                  )}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last ? (
                <ChevronRight aria-hidden className="h-3 w-3 shrink-0" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
